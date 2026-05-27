import logging
import math
import re
import os
from typing import Any
from urllib.parse import urlparse
from collections import Counter

import tldextract

from services.utils import calculate_risk_level, levenshtein_similarity, TARGET_BRANDS_DETAILED
from services.ml_analyzer import analyze_structure_with_ml

logger = logging.getLogger(__name__)

MAX_URL_LENGTH = 2048
ENTROPY_THRESHOLD = 0.82
LEVENSHTEIN_THRESHOLD = 0.80
MIN_WORD_LENGTH = 5

SUSPICIOUS_KEYWORDS: list[tuple[str, int, str]] = [
    # --- Inglés ---
    ("login", 15, "Login"),
    ("verify", 15, "Verify"),
    ("secure", 10, "Secure"),
    ("account", 10, "Account"),
    ("update", 10, "Update"),
    ("auth", 10, "Auth"),
    ("signin", 15, "Signin"),
    ("billing", 10, "Billing"),
    ("confirm", 10, "Confirm"),
    ("support", 5, "Support"),
    ("wallet", 10, "Wallet"),
    ("recovery", 10, "Recovery"),
    ("clone", 15, "Clone"),
    ("authenticate", 10, "Authenticate"),
    ("validation", 10, "Validation"),
    ("security", 5, "Security"),
    ("payment", 10, "Payment"),
    ("bank", 10, "Bank"),
    ("crypto", 10, "Crypto"),

    # --- Español ---
    ("acceder", 15, "Login (ES)"),
    ("iniciar", 15, "Login (ES)"),
    ("sesion", 15, "Login (ES)"),
    ("verificar", 15, "Verify (ES)"),
    ("seguro", 10, "Secure (ES)"),
    ("cuenta", 15, "Account (ES)"),
    ("actualizar", 10, "Update (ES)"),
    ("factura", 15, "Billing (ES)"),
    ("confirmar", 10, "Confirm (ES)"),
    ("soporte", 5, "Support (ES)"),
    ("billetera", 10, "Wallet (ES)"),
    ("cartera", 10, "Wallet (ES)"),
    ("recuperacion", 10, "Recovery (ES)"),
    ("pago", 10, "Payment (ES)"),
    ("banco", 10, "Bank (ES)"),
    ("bloqueada", 15, "Blocked (ES)"),
    ("reembolso", 15, "Refund (ES)"),

    # --- Francés ---
    ("connexion", 15, "Login (FR)"),
    ("compte", 10, "Account (FR)"),
    ("verifier", 10, "Verify (FR)"),
    ("securite", 10, "Security (FR)"),
    ("paiement", 10, "Payment (FR)"),
    ("facture", 15, "Billing (FR)"),

    # --- Portugués ---
    ("entrar", 15, "Login (PT)"),
    ("conta", 10, "Account (PT)"),
    ("verificar", 10, "Verify (PT)"),
    ("seguranca", 10, "Security (PT)"),
    ("pagamento", 10, "Payment (PT)"),

    # --- Alemán ---
    ("anmelden", 15, "Login (DE)"),
    ("konto", 10, "Account (DE)"),
    ("bestaetigen", 10, "Confirm (DE)"),
    ("sicherheit", 10, "Security (DE)"),
    ("rechnung", 15, "Billing (DE)")
]

ABUSED_FREE_HOSTING: list[tuple[str, int]] = [
    ("github.io", 25),
    ("gitlab.io", 25),
    ("herokuapp.com", 25),
    ("vercel.app", 25),
    ("netlify.app", 25),
    ("firebaseapp.com", 25),
    ("web.app", 25),
    ("glitch.me", 25),
    ("repl.co", 25),
    ("000webhostapp.com", 30),
    ("blogspot.com", 20),
    ("weebly.com", 20),
    ("wixsite.com", 20),
    ("wordpress.com", 20),
    ("pages.dev", 25),
    ("workers.dev", 25),
    ("surge.sh", 25),
    ("neocities.org", 20),
    ("tripod.com", 20),
    ("angelfire.com", 20),
    ("s3.amazonaws.com", 20),
    ("storage.googleapis.com", 20),
    ("ipfs.io", 30),
    ("bitbucket.io", 20),
]

def _validate_url(url: str) -> str:
    """Valida y normaliza una URL."""
    if not url or not isinstance(url, str):
        raise ValueError("URL inválida")
    url = url.strip()
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("URL demasiado larga")

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Esquema no soportado: {parsed.scheme}")
    if not parsed.hostname:
        raise ValueError("URL sin hostname")

    return url

def _calculate_normalized_entropy(text: str) -> float:
    """Calcula la entropía de Shannon normalizada (0.0 - 1.0)."""
    if not text:
        return 0.0
    length = len(text)
    if length <= 1:
        return 0.0

    counts = Counter(text)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)

    max_entropy = math.log2(length)
    return entropy / max_entropy if max_entropy > 0 else 0.0

def _detect_free_hosting(hostname: str) -> tuple[bool, list[str]]:
    """Detecta si el hostname usa un hosting gratuito abusado."""
    for domain, _ in ABUSED_FREE_HOSTING:
        if hostname == domain or hostname.endswith("." + domain):
            return True, [f"ABUSED_FREE_HOSTING ({domain})"]
    return False, []

def _detect_brand_impersonation(hostname: str, path: str) -> list[str]:
    """Detecta suplantación de marca en hostname o path."""
    flags: list[str] = []
    hostname_lower = hostname.lower()
    path_lower = path.lower()

    # tldextract una única vez fuera del bucle (evita 14 llamadas por URL)
    extracted = tldextract.extract(hostname_lower)

    for brand, official_tlds, official_subdomains in TARGET_BRANDS_DETAILED:
        brand_lower = brand.lower()

        # Evitar falsos positivos como "apple" dentro de "snapple.com"
        in_hostname = (
            brand_lower == extracted.domain or
            brand_lower in extracted.subdomain.split('.')
        )

        # Evitar falsos positivos en el path buscando como palabra completa
        in_path = bool(re.search(rf"\b{re.escape(brand_lower)}\b", path_lower))

        if not in_hostname and not in_path:
            continue

        is_official = False

        if extracted.domain == brand_lower and extracted.suffix in official_tlds:
            is_official = True
        if extracted.subdomain in official_subdomains:
            is_official = True
        if extracted.domain in official_subdomains:
            is_official = True

        if is_official:
            continue

        if in_hostname:
            flags.append(f"BRAND_IMPERSONATION_IN_HOSTNAME ({brand})")
        elif in_path:
            flags.append(f"BRAND_IMPERSONATION_IN_PATH ({brand})")
        break

    return flags

def _detect_entropy_and_dga(subdomain: str) -> list[str]:
    """Detecta subdominios con alta entropía (posible DGA)."""
    if not subdomain or len(subdomain) < 5:
        return []

    norm_entropy = _calculate_normalized_entropy(subdomain)
    has_consecutive_numbers = bool(re.search(r"\d{4,}", subdomain))

    if norm_entropy > ENTROPY_THRESHOLD or has_consecutive_numbers:
        confidence = f"entropy={norm_entropy:.2f}" if norm_entropy > ENTROPY_THRESHOLD else "consecutive_numbers"
        return [f"HIGH_ENTROPY_SUBDOMAIN ({confidence})"]

    return []

def _detect_suspicious_keywords(subdomain: str, path: str) -> list[str]:
    """Detecta keywords sospechosas y typos de keywords."""
    combined = f"{subdomain} {path}".lower()
    words = re.split(r"[^a-z0-9]", combined)

    found: list[str] = []

    for word in words:
        if not word or len(word) < MIN_WORD_LENGTH:
            continue

        for kw, _, label in SUSPICIOUS_KEYWORDS:
            if word == kw:
                found.append(label)
                break
        else:
            for kw, _, label in SUSPICIOUS_KEYWORDS:
                sim = levenshtein_similarity(word, kw)
                if sim >= LEVENSHTEIN_THRESHOLD and word != kw:
                    found.append(f"{label} (typo: {word})")
                    break

    if not found:
        return []

    unique_found = list(dict.fromkeys(found))
    return [f"SUSPICIOUS_KEYWORD ({kw})" for kw in unique_found]

class URLStructureAnalyzer:
    """Analizador avanzado de estructura de URLs."""

    def analyze(self, url: str) -> dict[str, Any]:
        """Analiza una URL y retorna riesgo y flags."""
        try:
            url = _validate_url(url)
        except ValueError as exc:
            logger.warning(f"URL rechazada: {exc}")
            return {"risk_score": 0, "level": "LOW", "flags": [f"ERROR: {exc}"]}

        parsed = urlparse(url)
        hostname = parsed.hostname.lower() if parsed.hostname else ""
        path = parsed.path.lower() if parsed.path else ""

        extracted = tldextract.extract(hostname)
        subdomain = extracted.subdomain

        flags: list[str] = []

        is_free_hosting, fh_flags = _detect_free_hosting(hostname)
        flags.extend(fh_flags)

        bi_flags = _detect_brand_impersonation(hostname, path)
        flags.extend(bi_flags)

        entropy_target = subdomain if not is_free_hosting else extracted.domain
        ent_flags = _detect_entropy_and_dga(entropy_target)
        flags.extend(ent_flags)

        kw_flags = _detect_suspicious_keywords(subdomain, path)
        flags.extend(kw_flags)

        # === Machine Learning Estructural ===
        # Delegamos TODO el peso del riesgo estructural a la IA
        ml_results = analyze_structure_with_ml(url)
        risk_score = ml_results.get("ml_score", 0)
        
        if ml_results.get("flags"):
            flags.extend(ml_results["flags"])

        risk_score = max(0, min(int(risk_score), 100))
        level = calculate_risk_level(risk_score)

        return {"risk_score": risk_score, "level": level, "flags": flags}
