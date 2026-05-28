#!/usr/bin/env python3
"""
Generador de dataset OSINT SINTÉTICO (versión robusta para dominios legítimos populares).
"""

import argparse
import csv
import os
import random
import sys

import numpy as np
from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.ml_analyzer import extract_structure_features

# ----------------------------------------------------------------------
SAMPLES_PER_CLASS = 10000
OUTPUT_FILE = "dataset_osint.csv"
SEED = 42

LEGIT_DOMAINS = [
    "google.com", "youtube.com", "facebook.com", "amazon.com", "wikipedia.org",
    "twitter.com", "instagram.com", "linkedin.com", "netflix.com", "apple.com",
    "microsoft.com", "github.com", "reddit.com", "bbc.co.uk", "nytimes.com",
    "spotify.com", "twitch.tv", "adobe.com", "wordpress.org", "vimeo.com",
    "cloudflare.com", "yahoo.com", "whatsapp.com", "canva.com", "zoom.us",
    "dropbox.com", "walmart.com", "target.com", "homedepot.com", "ebay.com",
    "stackoverflow.com", "quora.com", "pinterest.com", "tumblr.com", "flickr.com"
]

PHISHING_FILE = "phishing-links-ACTIVE.txt"

# ----------------------------------------------------------------------
def load_phishing_urls(filepath: str, max_samples: int) -> list:
    urls = []
    if not os.path.exists(filepath):
        print(f"⚠️ Archivo no encontrado: {filepath}")
        return []
    with open(filepath, encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f):
            url = line.strip()
            if not url.startswith("http"):
                url = "http://" + url
            if i < max_samples:
                urls.append(url)
            else:
                j = random.randint(0, i)
                if j < max_samples:
                    urls[j] = url
    return urls

def generate_legit_urls(count: int) -> list:
    urls = []
    paths = ["", "/", "/home", "/about", "/contact", "/user/profile",
             "/search?q=test", "/login", "/signup", "/secure",
             "/es/login", "/auth/login", "/my-account", "/support/contact",
             "/download", "/docs", "/blog", "/articles/how-to-secure-account"]
    subdomains = ["", "www.", "app.", "secure.", "api.", "help.", "es.", "support."]
    for _ in range(count):
        domain = random.choice(LEGIT_DOMAINS)
        sub = random.choice(subdomains)
        path = random.choice(paths)
        proto = random.choice(["http://", "https://"])
        urls.append(f"{proto}{sub}{domain}{path}")
    return urls

def generate_osint_features_legit() -> list:
    """
    Características OSINT para un dominio legítimo.
    """
    # WHOIS age: 15% tiene privacidad (devuelve 0)
    if random.random() < 0.15:
        whois_age = 0
    else:
        whois_age = random.randint(365, 3650) + random.randint(-30, 30)
        whois_age = max(1, whois_age)

    # SSL: emitido por CA, pero 5% puede ser autofirmado (intranets, error config)
    ssl_is_self_signed = 1 if random.random() < 0.05 else 0
    ssl_days_expiry = max(0, random.randint(30, 365) + random.randint(-5, 5)) if not ssl_is_self_signed else random.randint(0, 100)

    is_obfuscated_js = 1 if random.random() < 0.1 else 0

    # Trackers: gran dispersión
    if random.random() < 0.2:
        trackers_count = int(np.random.uniform(0, 5))
    else:
        trackers_count = int(np.random.triangular(2, 10, 40))

    return [whois_age, ssl_days_expiry, ssl_is_self_signed, is_obfuscated_js, trackers_count]

def generate_osint_features_phishing() -> list:
    """Características OSINT para un dominio de phishing (mucho más realista)."""
    # 90% tienen creación reciente, 10% son dominios secuestrados o expirados
    if random.random() < 0.9:
        whois_age = max(0, random.randint(0, 60))
    else:
        whois_age = random.randint(365, 3000)

    # El phishing moderno usa Let's Encrypt (SSL válido). Sólo el 30% usa autofirmado o sin SSL
    ssl_is_self_signed = 1 if random.random() < 0.3 else 0
    if ssl_is_self_signed:
        ssl_days_expiry = max(0, random.randint(0, 30))
    else:
        ssl_days_expiry = max(10, random.randint(30, 90)) # Let's Encrypt dura 90 días

    # El phishing ofusca a menudo, pero no siempre
    is_obfuscated_js = 1 if random.random() < 0.5 else 0

    # Trackers: suelen tener muy pocos (0 o 1), pero a veces inyectan google analytics falso
    if random.random() < 0.2:
        trackers_count = random.randint(1, 5)
    else:
        trackers_count = max(0, np.random.poisson(1))

    return [whois_age, ssl_days_expiry, ssl_is_self_signed, is_obfuscated_js, trackers_count]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples-per-class", type=int, default=SAMPLES_PER_CLASS)
    parser.add_argument("--output", type=str, default=OUTPUT_FILE)
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed + 1)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    phishing_path = os.path.join(os.path.dirname(base_dir), PHISHING_FILE)
    output_path = os.path.join(base_dir, args.output)

    legit_urls = generate_legit_urls(args.samples_per_class)
    phishing_urls = load_phishing_urls(phishing_path, args.samples_per_class)
    print(f"URLs legítimas: {len(legit_urls)}, phishing: {len(phishing_urls)}")

    headers = [
        "url_len", "domain_len", "path_len", "dots_count", "hyphens_count",
        "has_numbers", "entropy", "has_keywords", "suspicious_tld",
        "whois_domain_age", "ssl_days_expiry", "ssl_is_self_signed",
        "is_obfuscated_js", "trackers_count", "label"
    ]

    total = len(legit_urls) + len(phishing_urls)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        with tqdm(total=total, desc="Generando dataset OSINT") as pbar:
            for url in legit_urls:
                try:
                    struct = extract_structure_features(url)
                    osint = generate_osint_features_legit()
                    writer.writerow(struct + osint + [0])
                except Exception:
                    pass
                pbar.update(1)
            for url in phishing_urls:
                try:
                    struct = extract_structure_features(url)
                    osint = generate_osint_features_phishing()
                    writer.writerow(struct + osint + [1])
                except Exception:
                    pass
                pbar.update(1)

    print(f"✅ Dataset generado: {output_path} ({total} muestras)")

if __name__ == "__main__":
    main()
