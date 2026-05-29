from urllib.parse import urlparse

import Levenshtein

from services.utils import calculate_shannon_entropy

# Marcas objetivo (amplía según necesites)
BRANDS = [
    "netflix", "google", "facebook", "amazon", "apple", "microsoft", "paypal",
    "instagram", "whatsapp", "bankofamerica", "chase", "wellsfargo", "linkedin",
    "dropbox", "adobe", "spotify", "ebay", "alibaba", "twitter", "x.com",
    "tiktok", "zoom", "canva", "binance", "dgt", "correos"
]

# TLDs de alto riesgo (se usan mucho en phishing)
HIGH_RISK_TLDS = {
    "tk": 0.9, "ml": 0.9, "ga": 0.9, "cf": 0.9, "xyz": 0.8,
    "top": 0.7, "work": 0.7, "date": 0.6, "racing": 0.6, "win": 0.5,
    "bid": 0.5, "trade": 0.5, "webcam": 0.5, "party": 0.5, "stream": 0.5
}


def extract_advanced_features(url: str) -> list:
    """
    Devuelve una lista de características (13 en total) para una URL.
    Las primeras 9 son las originales; las 4 nuevas son:
    - domain_digit_ratio
    - tld_risk_score
    - brand_distance
    - has_brand_typo
    """
    try:
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        path = parsed.path or ""
        full_url = url.lower()

        # --- Características originales (mantenemos compatibilidad) ---
        url_len = len(url)
        domain_len = len(domain)
        path_len = len(path)
        dots_count = domain.count('.')
        hyphens_count = domain.count('-')
        has_numbers = int(any(c.isdigit() for c in url))
        entropy = calculate_shannon_entropy(url.encode('utf-8'))
        has_keywords = int(any(kw in full_url for kw in [
            "login", "signin", "verify", "secure", "account", "update", "confirm"
        ]))
        suspicious_tld = int(domain.split('.')[-1] in HIGH_RISK_TLDS)

        # --- Nuevas características específicas de dominio ---
        # Proporción de dígitos en el dominio
        domain_digits = sum(c.isdigit() for c in domain)
        domain_digit_ratio = domain_digits / max(len(domain), 1)

        # Riesgo del TLD (0-1)
        tld = domain.split('.')[-1] if '.' in domain else ""
        tld_risk_score = HIGH_RISK_TLDS.get(tld, 0.1)   # 0.1 por defecto

        # Similitud con marcas (distancia de Levenshtein normalizada)
        domain_name = domain.split('.')[0]   # solo el SLD, ej: "n3tflix" o "www" (se ajusta fácil luego)

        # Mejor extraer el dominio base ignorando el www.
        domain_parts = domain.split('.')
        if len(domain_parts) >= 2:
            domain_name = domain_parts[-2] # Ej: www.netflix.com -> netflix
        else:
            domain_name = domain_parts[0]

        min_dist = 1.0
        for brand in BRANDS:
            dist = Levenshtein.distance(domain_name, brand)
            norm_dist = dist / max(len(domain_name), len(brand))
            if norm_dist < min_dist:
                min_dist = norm_dist
        brand_distance = min_dist   # 0 = idéntico, 1 = muy diferente

        # ¿Hay un typo cercano a alguna marca? (umbral 0.2)
        # Si la distancia es mayor que 0 (no es la marca exacta) pero menor a 0.2 (es un typo como n3tflix)
        has_brand_typo = int(0 < brand_distance < 0.2)

        # NUEVO: coincidencia exacta (distancia == 0)
        has_exact_brand = int(brand_distance == 0.0)

        features = [
            url_len, domain_len, path_len, dots_count, hyphens_count,
            has_numbers, entropy, has_keywords, suspicious_tld,
            domain_digit_ratio, tld_risk_score, brand_distance, has_brand_typo,
            has_exact_brand   # <-- característica 14
        ]
        return features

    except Exception:
        return None
