import math
import re
import logging
from collections import Counter
import joblib
import os
from urllib.parse import urlparse
from datetime import datetime, timezone
import pandas as pd

from models.osint_models import OSINTResponse
from services.utils import calculate_risk_level
from services.advanced_features import extract_advanced_features

logger = logging.getLogger(__name__)

_structure_model = None
_osint_model = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRUCTURE_MODEL_PATH = os.path.join(BASE_DIR, "models", "phishing_structure_rf.joblib")
OSINT_MODEL_PATH = os.path.join(BASE_DIR, "models", "phishing_osint_rf.joblib")

def load_structure_model():
    global _structure_model
    if _structure_model is None and os.path.exists(STRUCTURE_MODEL_PATH):
        try:
            _structure_model = joblib.load(STRUCTURE_MODEL_PATH)
        except Exception as e:
            logger.error(f"Error cargando modelo ML Estructural: {e}")
    return _structure_model

def load_osint_model():
    global _osint_model
    if _osint_model is None and os.path.exists(OSINT_MODEL_PATH):
        try:
            _osint_model = joblib.load(OSINT_MODEL_PATH)
        except Exception as e:
            logger.error(f"Error cargando modelo ML OSINT: {e}")
    return _osint_model

def calculate_entropy(text: str) -> float:
    """Calcula la entropía de Shannon de un string."""
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    return -sum((count/length) * math.log2(count/length) for count in counts.values())

def extract_structure_features(url: str) -> list[float]:
    """
    Extrae 9 características estructurales básicas de una URL.

    NOTA: Esta función se mantiene únicamente para compatibilidad con el pipeline OSINT
    (generate_osint_dataset_synthetic.py). Para la inferencia de estructura con ML,
    se usa extract_advanced_features() (13 features).
    """
    url_lower = url.lower()
    url_no_proto = re.sub(r"^https?://", "", url_lower)

    parts = url_no_proto.split("/")
    domain = parts[0]
    path = "/" + "/".join(parts[1:]) if len(parts) > 1 else ""

    return [
        len(url),                       # Longitud total
        len(domain),                    # Longitud del dominio
        len(path),                      # Longitud del path
        url_lower.count('.'),           # Cantidad de puntos (subdominios excesivos)
        url_lower.count('-'),           # Cantidad de guiones
        1.0 if re.search(r"\d{4,}", domain) else 0.0,  # Números consecutivos en dominio
        calculate_entropy(domain),      # Entropía del dominio
        1.0 if any(kw in url_lower for kw in ["login", "secure", "account", "verify", "update", "banking"]) else 0.0,
        1.0 if domain.endswith((".xyz", ".top", ".pw", ".tk", ".ml", ".ga", ".cf", ".gq")) else 0.0,
    ]

def extract_osint_features_from_response(url: str, response: OSINTResponse) -> list:
    """
    Convierte un OSINTResponse en las 5 características OSINT utilizadas
    en el dataset sintético (whois_domain_age, ssl_days_expiry, 
    ssl_is_self_signed, is_obfuscated_js, trackers_count).
    
    Si algún campo no está disponible, asigna un valor por defecto que 
    refleje "riesgo de phishing" (por seguridad).
    """
    # WHOIS domain age (días)
    try:
        if response and response.whois and response.whois.creation_date:
            creation = datetime.fromisoformat(response.whois.creation_date.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            whois_age = float((now - creation).days)
        else:
            whois_age = 0.0
    except Exception:
        whois_age = 0.0

    # SSL
    try:
        if response and response.ssl:
            ssl_days_expiry = response.ssl.days_until_expiry if response.ssl.days_until_expiry is not None else 0.0
            ssl_self_signed = 1.0 if response.ssl.is_self_signed else 0.0
        else:
            ssl_days_expiry = 0.0
            ssl_self_signed = 1.0
    except Exception:
        ssl_days_expiry = 0.0
        ssl_self_signed = 1.0

    # JavaScript ofuscado
    try:
        is_obfuscated = 1.0 if (response and response.tech_data and response.tech_data.is_obfuscated_js) else 0.0
    except Exception:
        is_obfuscated = 1.0  # en caso de duda, considerar que puede estar ofuscado

    # Trackers
    try:
        trackers = float(response.privacy_analysis.trackers_count) if (response and response.privacy_analysis) else 0.0
    except Exception:
        trackers = 0.0

    return [whois_age, ssl_days_expiry, ssl_self_signed, is_obfuscated, trackers]


def extract_ml_features(url: str, osint_data: OSINTResponse | None = None) -> list[float]:
    """Extrae las 14 características (9 estructura + 5 OSINT) para el modelo profundo."""
    return extract_structure_features(url) + extract_osint_features_from_response(url, osint_data)

def analyze_structure_with_ml(url: str) -> dict:
    """Inferencia súper rápida usando solo la estructura de la URL."""
    model = load_structure_model()
    if not model:
        return {"ml_score": 0, "flags": []}
    
    try:
        feature_names = [
            "url_len", "domain_len", "path_len", "dots_count", "hyphens_count", 
            "has_numbers", "entropy", "has_keywords", "suspicious_tld",
            "domain_digit_ratio", "tld_risk_score", "brand_distance", "has_brand_typo",
            "has_exact_brand"
        ]
        features = extract_advanced_features(url)
        if not features:
            return {"ml_score": 0, "flags": []}
            
        features_df = pd.DataFrame([features], columns=feature_names)
        prob = model.predict_proba(features_df)[0][1]
        score = int(prob * 100)
        
        flags = []
        if score >= 80:
            flags.append(f"ML_STRUCTURE_CRITICAL (Prob: {prob:.2f})")
        elif score >= 50:
            flags.append(f"ML_STRUCTURE_HIGH (Prob: {prob:.2f})")
            
        return {"ml_score": score, "flags": flags}
    except Exception as e:
        logger.error(f"Error inferencia ML Estructural: {e}")
        return {"ml_score": 0, "flags": []}

def analyze_osint_with_ml(url: str, osint_data: OSINTResponse) -> dict:
    """Inferencia profunda usando OSINT y estructura."""
    model = load_osint_model()
    if not model:
        return {"ml_score": 0, "flags": []}
        
    try:
        feature_names = [
            "url_len", "domain_len", "path_len", "dots_count", "hyphens_count", 
            "has_numbers", "entropy", "has_keywords", "suspicious_tld",
            "whois_domain_age", "ssl_days_expiry", "ssl_is_self_signed", 
            "is_obfuscated_js", "trackers_count"
        ]
        features = extract_ml_features(url, osint_data)
        features_df = pd.DataFrame([features], columns=feature_names)
        
        prob = model.predict_proba(features_df)[0][1]
        score = int(prob * 100)
        
        flags = []
        if score >= 85:
            flags.append(f"ML_OSINT_CRITICAL (Prob: {prob:.2f})")
        elif score >= 60:
            flags.append(f"ML_OSINT_HIGH (Prob: {prob:.2f})")
            
        return {"ml_score": score, "flags": flags}
    except Exception as e:
        logger.error(f"Error inferencia ML OSINT: {e}")
        return {"ml_score": 0, "flags": []}
