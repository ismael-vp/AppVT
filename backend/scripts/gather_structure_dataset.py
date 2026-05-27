#!/usr/bin/env python3
"""
Generador de dataset estructural masivo (13 features + label).
Incluye un 40% de URLs de confianza (plantillas de sitios populares)
para evitar falsos positivos en dominios legítimos.
"""

import csv
import logging
import os
import sys
import random
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from itertools import islice
from typing import List, Tuple

import tqdm

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.advanced_features import extract_advanced_features

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Parámetros por defecto
SAMPLES_PER_CLASS = 700_000
OUTPUT_FILE = "dataset_structure.csv"
PHISHING_FILE = "phishing-links-ACTIVE.txt"
BATCH_SIZE = 50_000
SEED = 42
TRUSTED_RATIO = 0.4   # 40% de URLs legítimas desde plantillas reales

LEGIT_DOMAINS = [
    "google.com", "youtube.com", "facebook.com", "amazon.com", "wikipedia.org",
    "twitter.com", "instagram.com", "linkedin.com", "netflix.com", "apple.com",
    "microsoft.com", "github.com", "reddit.com", "bbc.co.uk", "nytimes.com",
    "spotify.com", "twitch.tv", "adobe.com", "wordpress.org", "vimeo.com",
    "cloudflare.com", "yahoo.com", "whatsapp.com", "canva.com", "zoom.us",
    "medium.com", "dropbox.com", "walmart.com", "target.com", "homedepot.com",
    "stackoverflow.com", "quora.com", "pinterest.com", "tumblr.com", "flickr.com"
]

COMMON_PATHS = [
    "", "/", "/home", "/about", "/contact", "/user/profile", "/search",
    "/login", "/signup", "/secure", "/update", "/es/login", "/auth/login",
    "/my-account", "/support/contact", "/download", "/docs", "/blog",
    "/articles/how-to-secure-account", "/shop/cart", "/checkout", "/api/v1/users",
    "/faq", "/terms", "/privacy", "/settings", "/notifications", "/orders/history"
]

COMMON_QUERIES = [
    "", "?lang=es", "?session=active", "?ref=homepage",
    "?utm_source=google", "?utm_medium=cpc", "?login=true",
    "?action=update", "?q=secure", "?page=1&sort=asc",
    "?id=12345&view=summary", "?token=abc123xyz", "?locale=en_US"
]

SUB_DOMAINS = ["", "www.", "app.", "secure.", "api.", "help.", "blog.", "es.", "support.", "m.", "shop."]

# ----------------------------------------------------------------------
# PLANTILLAS DE CONFIANZA (NUEVAS PARA YOUTUBE Y OTROS)
TRUSTED_TEMPLATES = [
    # YouTube
    "https://www.youtube.com/",
    "https://www.youtube.com/feed/subscriptions",
    "https://www.youtube.com/channel/{channelid}",
    "https://www.youtube.com/watch?v={videoid}",
    "https://m.youtube.com/",
    "https://music.youtube.com/",
    # Google
    "https://www.google.com/search?q={query}",
    "https://www.google.com/maps/",
    "https://drive.google.com/drive/u/0/my-drive",
    "https://mail.google.com/mail/u/0/#inbox",
    "https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn",
    # Netflix
    "https://www.netflix.com/browse",
    "https://www.netflix.com/login",
    "https://www.netflix.com/YourAccount",
    "https://netflix.com/{lang}/login",
    "https://help.netflix.com/{lang}/node/{nodeid}",
    "https://www.netflix.com/browse/genre/{genreid}",
    # Facebook
    "https://www.facebook.com/login/",
    "https://www.facebook.com/{username}/friends",
    "https://www.facebook.com/help/",
    # Amazon
    "https://www.amazon.com/gp/cart/view.html",
    "https://www.amazon.com/gp/product/{asin}",
    "https://www.amazon.com/dp/{asin}",
    # Apple
    "https://www.apple.com/shop/buy-iphone",
    "https://appleid.apple.com/account/manage",
    # Microsoft
    "https://login.live.com/",
    "https://account.microsoft.com/account/",
    # Wikipedia
    "https://{lang}.wikipedia.org/wiki/{article}",
    "https://en.wikipedia.org/wiki/Special:UserLogin",
    # LinkedIn
    "https://www.linkedin.com/login",
    "https://www.linkedin.com/in/{username}/",
    # PayPal
    "https://www.paypal.com/signin",
    "https://www.paypal.com/myaccount/summary",
    # Otros populares
    "https://open.spotify.com/playlist/{playlistid}",
    "https://www.twitch.tv/{channelname}",
    "https://www.bbc.co.uk/news/technology",
    "https://www.nytimes.com/section/world",
    "https://www.reddit.com/r/{subreddit}/",
    "https://www.reddit.com/login/",
    "https://www.whatsapp.com/download/",
    "https://www.zoom.us/signin",
    "https://www.x.com/login",
    "https://www.tiktok.com/@{username}",
    "https://www.duckduckgo.com/?q={query}",
    "https://www.ebay.com/sch/i.html?_nkw={item}",
    "https://www.booking.com/hotel/{hotelname}.html",
    "https://www.airbnb.com/rooms/{roomid}",
    "https://www.uber.com/ride/",
    "https://stackoverflow.com/questions/{questionid}/{title}",
    "https://www.pinterest.com/{username}/boards/",
    "https://www.dropbox.com/login",
    "https://www.dropbox.com/sh/{shareid}",
    "https://www.walmart.com/account/login",
    "https://www.target.com/c/help/-/N-4sr6p",
    "https://www.binance.com/{lang}/login",
    "https://www.dgt.es/es/",
    "https://www.correos.es/es/es/herramientas/localizador/envios",
    "https://www.openai.com/chatgpt"
]

PLACEHOLDERS = {
    "lang": ["es", "en", "fr", "de", "it", "pt"],
    "nodeid": lambda: str(random.randint(10000, 99999)),
    "genreid": lambda: str(random.randint(1000, 9999)),
    "movieid": lambda: str(random.randint(80000000, 89999999)),
    "query": ["secure", "login", "help", "weather", "news", "sports", "python", "machine+learning"],
    "docid": lambda: f"1{'_'*10}{random.randint(100000000, 999999999)}",
    "videoid": ["dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0"],
    "channelid": lambda: f"UC{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=22))}",
    "username": ["johndoe", "maria.garcia", "tech.enthusiast", "travelblog", "foodie.chef"],
    "asin": ["B08L5LG4D3", "B09G9D7K6X", "B0B3H6J5T9"],
    "articleid": ["HT201234", "HT205678"],
    "article": ["Python_(programming_language)", "URL_shortening", "Phishing"],
    "helpid": ["4027675", "12438"],
    "subreddit": ["python", "news", "worldnews", "technology"],
    "meetingid": lambda: str(random.randint(10000000000, 99999999999)),
    "item": ["laptop", "shoes", "books", "camera"],
    "hotelname": ["grand-hotel", "the-ritz", "marriott-marquis"],
    "roomid": lambda: str(random.randint(10000000, 99999999)),
    "skuid": ["100123456", "200987654"],
    "questionid": lambda: str(random.randint(1000000, 9999999)),
    "title": ["how-to-improve-code", "python-decorators-explained"],
    "shareid": ["abc123def456", "xyz789uvw012"],
    "productname": ["power-drill", "garden-hose"],
    "playlistid": lambda: f"{random.randint(1,9)}H{random.randint(100,999)}aBcD",
    "channelname": ["loltyler1", "ninja", "shroud"]
}

# ----------------------------------------------------------------------
def load_phishing_urls(filepath: str, max_samples: int, seed: int = None) -> List[str]:
    if not os.path.exists(filepath):
        logger.error(f"No se encontró {filepath}")
        return []
    random.seed(seed)
    reservoir = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f):
            url = line.strip()
            if not url.startswith("http"):
                url = "http://" + url
            if i < max_samples:
                reservoir.append(url)
            else:
                j = random.randint(0, i)
                if j < max_samples:
                    reservoir[j] = url
    logger.info(f"Cargadas {len(reservoir)} URLs de phishing")
    return reservoir

def _fill_template(template: str) -> str:
    import re
    pattern = re.compile(r"\{(\w+)\}")
    def replacer(match):
        key = match.group(1)
        if key in PLACEHOLDERS:
            val = PLACEHOLDERS[key]
            if callable(val):
                return val()
            return random.choice(val)
        return match.group(0)
    return pattern.sub(replacer, template)

def generate_trusted_urls(count: int) -> List[str]:
    urls = []
    for _ in range(count):
        template = random.choice(TRUSTED_TEMPLATES)
        url = _fill_template(template)
        urls.append(url)
    return urls

def generate_random_legit_urls(count: int) -> List[str]:
    urls = []
    alnum = "abcdefghijklmnopqrstuvwxyz0123456789"
    for _ in range(count):
        domain = random.choice(LEGIT_DOMAINS)
        sub = random.choice(SUB_DOMAINS)
        path = random.choice(COMMON_PATHS)
        query = random.choice(COMMON_QUERIES) if random.random() < 0.3 else ""
        if random.random() < 0.15:
            extra_parts = random.randint(1, 2)
            for _ in range(extra_parts):
                slug = "".join(random.choices(alnum, k=random.randint(3, 8)))
                path = f"{path}/{slug}"
        fragment = ""
        if random.random() < 0.1:
            fragment = "#" + "".join(random.choices(alnum, k=random.randint(3, 6)))
        port = ""
        if random.random() < 0.02:
            port = f":{random.choice([80, 443, 8080, 8443])}"
        urls.append(f"https://{sub}{domain}{port}{path}{query}{fragment}")
    return urls

def generate_legit_urls(total: int, trusted_ratio: float = 0.4, seed: int = None) -> List[str]:
    random.seed(seed)
    trusted_count = int(total * trusted_ratio)
    random_count = total - trusted_count
    trusted = generate_trusted_urls(trusted_count)
    random_legit = generate_random_legit_urls(random_count)
    all_urls = trusted + random_legit
    random.shuffle(all_urls)
    return all_urls

def extract_features_batch(urls_labels: List[Tuple[str, int]]) -> List[Tuple[list, int]]:
    results = []
    for url, label in urls_labels:
        try:
            features = extract_advanced_features(url)
            results.append((features, label))
        except Exception as e:
            results.append(None)
    return results

def chunked(iterable, size):
    it = iter(iterable)
    while True:
        chunk = list(islice(it, size))
        if not chunk:
            break
        yield chunk

def write_csv_header(output_path: str, headers: List[str]):
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)

def process_dataset(phishing_urls, legit_urls, output_path, num_workers=4, batch_size=BATCH_SIZE):
    all_data = [(url, 0) for url in legit_urls] + [(url, 1) for url in phishing_urls]
    random.shuffle(all_data)
    total = len(all_data)
    headers = [
        "url_len", "domain_len", "path_len", "dots_count", "hyphens_count",
        "has_numbers", "entropy", "has_keywords", "suspicious_tld",
        "domain_digit_ratio", "tld_risk_score", "brand_distance", "has_brand_typo",
        "has_exact_brand",
        "label"
    ]
    write_csv_header(output_path, headers)
    chunks = list(chunked(all_data, batch_size))
    valid = 0
    errors = 0
    with tqdm.tqdm(total=total, desc="Generando dataset", unit=" URLs") as pbar:
        for chunk in chunks:
            with ProcessPoolExecutor(max_workers=num_workers) as executor:
                sub_chunks = list(chunked(chunk, max(1, len(chunk) // num_workers)))
                futures = [executor.submit(extract_features_batch, sub) for sub in sub_chunks]
                batch_results = []
                for future in as_completed(futures):
                    batch_results.extend(future.result())
            with open(output_path, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                for result in batch_results:
                    if result is None:
                        errors += 1
                        continue
                    features, label = result
                    writer.writerow(features + [label])
                    valid += 1
            pbar.update(len(chunk))
    logger.info(f"Dataset generado: {valid} muestras válidas, {errors} errores")

def main():
    parser = argparse.ArgumentParser(description="Genera dataset estructural con plantillas de confianza.")
    parser.add_argument("--phishing-file", default=PHISHING_FILE)
    parser.add_argument("--output", default=OUTPUT_FILE)
    parser.add_argument("--samples-per-class", type=int, default=SAMPLES_PER_CLASS)
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--trusted-ratio", type=float, default=TRUSTED_RATIO)
    args = parser.parse_args()

    random.seed(args.seed)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    project_dir = os.path.dirname(backend_dir)
    phishing_path = os.path.join(project_dir, args.phishing_file)
    output_path = os.path.join(backend_dir, args.output)

    phishing_urls = load_phishing_urls(phishing_path, args.samples_per_class, seed=args.seed)
    if not phishing_urls:
        logger.error("No se pudieron cargar URLs de phishing.")
        return
    legit_urls = generate_legit_urls(len(phishing_urls), trusted_ratio=args.trusted_ratio,
                                     seed=args.seed + 1)
    logger.info(f"Legítimas generadas: {len(legit_urls)} (~{args.trusted_ratio*100:.0f}% confianza)")
    process_dataset(phishing_urls, legit_urls, output_path, num_workers=args.workers,
                    batch_size=args.batch_size)
    logger.info("✅ Dataset estructural completado.")

if __name__ == "__main__":
    main()
