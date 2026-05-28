import csv
import logging
import os
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

    @staticmethod
    def save_organic_sample(url: str, osint_data: OSINTResponse, is_malicious: bool):
        """
        Extrae las características de osint_data y las guarda en un CSV.
        Se ejecuta en segundo plano para no bloquear la respuesta de la API.
        """
        try:
            # Asegurar que el directorio existe
            os.makedirs(DATA_DIR, exist_ok=True)

            file_exists = os.path.exists(DATASET_PATH)

            # Extraer las 5 características (whois_age, ssl_days, ssl_self, is_obfuscated, trackers)
            features = extract_osint_features_from_response(url, osint_data)

            # Formatear el registro
            # Añadimos timestamp y la URL original (aunque para ML solo usemos los features y el label)
            label = 1 if is_malicious else 0
            row = [
                datetime.utcnow().isoformat(),
                url,
                features[0], # whois_age
                features[1], # ssl_days_expiry
                features[2], # ssl_is_self_signed
                features[3], # is_obfuscated_js
                features[4], # trackers_count
                label
            ]

            with open(DATASET_PATH, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if not file_exists:
                    # Escribir cabeceras si el archivo es nuevo
                    writer.writerow([
                        "timestamp", "url", "whois_age", "ssl_days_expiry",
                        "ssl_is_self_signed", "is_obfuscated_js", "trackers_count", "label"
                    ])
                writer.writerow(row)

            logger.info(f"✅ Muestra orgánica OSINT guardada para {url} (label: {label})")
        except Exception as e:
            logger.error(f"Error guardando muestra orgánica OSINT: {e}")
