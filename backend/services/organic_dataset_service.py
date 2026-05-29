import csv
import logging
import os
import threading
from datetime import datetime

from models.osint_models import OSINTResponse
from services.ml_analyzer import extract_osint_features_from_response

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATASET_PATH = os.path.join(DATA_DIR, "organic_osint_dataset.csv")

class OrganicDatasetService:
    """
    Servicio para recolectar silenciosamente características OSINT reales
    extraídas de los escaneos en producción.
    """
    _lock = threading.Lock()

    @staticmethod
    def save_organic_sample(url: str, osint_data: OSINTResponse, is_malicious: bool):
        """
        Extrae las características de osint_data y las guarda en un CSV.
        Se ejecuta en segundo plano para no bloquear la respuesta de la API.
        """
        try:
            os.makedirs(DATA_DIR, exist_ok=True)

            features = extract_osint_features_from_response(url, osint_data)

            label = 1 if is_malicious else 0
            row = [
                datetime.utcnow().isoformat(),
                url,
                features[0],
                features[1],
                features[2],
                features[3],
                features[4],
                label
            ]

            with OrganicDatasetService._lock:
                file_exists = os.path.exists(DATASET_PATH)
                with open(DATASET_PATH, mode="a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    if not file_exists:
                        writer.writerow([
                            "timestamp", "url", "whois_age", "ssl_days_expiry",
                            "ssl_is_self_signed", "is_obfuscated_js", "trackers_count", "label"
                        ])
                    writer.writerow(row)

            logger.info(f"✅ Muestra orgánica OSINT guardada para {url} (label: {label})")
        except Exception as e:
            logger.error(f"Error guardando muestra orgánica OSINT: {e}")
