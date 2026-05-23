import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from models.osint_models import (
    HeuristicResult,
    TyposquattingData,
    URLStructureResult,
)
from services.scanners.typosquatting_scanner import TyposquattingScanner
from services.scanners.url_structure_analyzer import URLStructureAnalyzer
from services.utils import calculate_risk_level

logger = logging.getLogger(__name__)

MAX_RISK_SCORE = 100
MIN_RISK_SCORE = 0

LEVEL_CRITICAL_THRESHOLD = 70
LEVEL_HIGH_THRESHOLD = 50
LEVEL_MEDIUM_THRESHOLD = 25

TYPOSQUATTING_BASE_PENALTY = 30
TYPOSQUATTING_MAX_PENALTY = 55

def _extract_hostname(url: str) -> str:
    """Extrae y valida el hostname de una URL."""
    parsed = urlparse(url)
    if not parsed.hostname:
        raise ValueError(f"No se pudo extraer hostname de la URL: {url}")
    return parsed.hostname.lower()

# _calculate_level eliminado: usar calculate_risk_level de services.utils

def _compute_typosquatting_penalty(typos_data: TyposquattingData) -> int:
    """Calcula una penalización graduada por typosquatting."""
    confidence = getattr(typos_data, "confidence", None)
    if isinstance(confidence, (int, float)) and 0 <= confidence <= 1:
        penalty = TYPOSQUATTING_BASE_PENALTY + int(
            (TYPOSQUATTING_MAX_PENALTY - TYPOSQUATTING_BASE_PENALTY) * confidence
        )
        return penalty
    return TYPOSQUATTING_BASE_PENALTY

class HeuristicScanner:
    """Orquesta el análisis heurístico avanzado."""

    def __init__(self):
        self.url_analyzer = URLStructureAnalyzer()
        self.typos_scanner = TyposquattingScanner()

    async def run_full_heuristics(
        self,
        url: str,
        hostname: str | None = None,
        osint_data: Any = None
    ) -> HeuristicResult:
        """Ejecuta todos los escáneres heurísticos y consolida el riesgo."""
        if not url or not isinstance(url, str):
            logger.error("URL inválida.")
            return HeuristicResult(risk_score=0, level="LOW", flags=["ERROR: URL inválida"])

        url = url.strip()
        if not url.startswith(("http://", "https://")):
            logger.error(f"Esquema de URL no soportado: {url[:50]}")
            return HeuristicResult(risk_score=0, level="LOW", flags=["ERROR: Esquema inválido"])

        try:
            extracted_hostname = hostname.strip().lower() if hostname else _extract_hostname(url)
        except ValueError as exc:
            logger.error(f"Error extrayendo hostname: {exc}")
            return HeuristicResult(risk_score=0, level="LOW", flags=["ERROR: Hostname inválido"])

        struct_task = asyncio.create_task(
            self._analyze_url_structure(url),
            name="url_structure_analysis"
        )
        typos_task = asyncio.create_task(
            self.typos_scanner.check_typosquatting(extracted_hostname),
            name="typosquatting_analysis"
        )

        struct_result, typos_result = await asyncio.gather(
            struct_task,
            typos_task,
            return_exceptions=True
        )

        url_anatomy: URLStructureResult | None = None
        base_score = 0
        flags: list[str] = []

        if isinstance(struct_result, Exception):
            logger.error(f"Error en URLStructureAnalyzer: {struct_result}")
            flags.append("ERROR: Fallo en estructura URL")
        elif struct_result is not None:
            url_anatomy = struct_result
            base_score = url_anatomy.risk_score
            flags = list(url_anatomy.flags)

        typos_data: TyposquattingData | None = None
        if isinstance(typos_result, Exception):
            logger.error(f"Error en TyposquattingScanner: {typos_result}")
            flags.append("ERROR: Fallo en typosquatting")
        elif typos_result is not None and typos_result.is_typosquatting:
            typos_data = typos_result
            penalty = _compute_typosquatting_penalty(typos_data)
            base_score += penalty
            brand = typos_data.target_brand or "desconocida"
            flags.append(f"TYPOSQUATTING_DETECTED (marca: {brand}, penalización: +{penalty})")

        whois_data = osint_data.whois if osint_data else None
        if whois_data and whois_data.creation_date:
            try:
                creation_dt = datetime.fromisoformat(whois_data.creation_date)
                if creation_dt.tzinfo is None:
                    creation_dt = creation_dt.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                age_days = (now - creation_dt).days
                if age_days < 30:
                    base_score += 15
                    flags.append(f"RECENTLY_REGISTERED_DOMAIN ({age_days} days)")
            except Exception as e:
                logger.error(f"Error calculando edad del dominio: {e}")

        if osint_data and osint_data.tech_data:
            if osint_data.tech_data.is_obfuscated_js:
                base_score += 30
                flags.append("OBFUSCATED_JS_DETECTED")
            if osint_data.tech_data.anti_bot_detected:
                base_score += 25
                flags.append("ANTI_BOT_EVASION_DETECTED")

            if osint_data.tech_data.ocr_extracted_brands:
                html_lower = osint_data.tech_data.html_content.lower() if osint_data.tech_data.html_content else ""
                has_login_indicators = "password" in html_lower or 'type="password"' in html_lower or "<form" in html_lower

                import tldextract
                extracted = tldextract.extract(extracted_hostname)

                for brand in osint_data.tech_data.ocr_extracted_brands:
                    from services.utils import TARGET_BRANDS
                    official_domain = TARGET_BRANDS.get(brand, brand)
                    
                    brand_lower = brand.lower()
                    
                    # Si el dominio base coincide exactamente con la marca (ej. google.es -> google)
                    # asumimos que es una variante regional legítima y no suplantación.
                    if extracted.domain == brand_lower:
                        continue
                    
                    if official_domain not in extracted_hostname:
                        base_score += 85
                        flags.append(f"VISUAL_BRAND_IMPERSONATION (Marca detectada: {brand.capitalize()})")

        if osint_data and osint_data.ssl:
            if osint_data.ssl.is_suspicious:
                base_score += 20
                if osint_data.ssl.cipher_suite:
                    flags.append(f"SUSPICIOUS_SSL ({osint_data.ssl.cipher_suite})")
                else:
                    flags.append("SUSPICIOUS_SSL")

        if osint_data and osint_data.geolocation and osint_data.geolocation.asn:
            suspicious_asns = ["AS20473", "AS16276", "AS14061", "AS4134", "AS4837", "AS5089", "AS206446"]
            if any(asn in osint_data.geolocation.asn for asn in suspicious_asns):
                base_score += 30
                flags.append(f"SUSPICIOUS_ASN ({osint_data.geolocation.asn})")

        final_score = max(MIN_RISK_SCORE, min(base_score, MAX_RISK_SCORE))
        final_level = calculate_risk_level(final_score)

        return HeuristicResult(
            risk_score=final_score,
            level=final_level,
            flags=flags,
            typosquatting=typos_data,
            url_anatomy=url_anatomy
        )

    async def _analyze_url_structure(self, url: str) -> URLStructureResult | None:
        """Ejecuta el URLStructureAnalyzer de forma segura."""
        try:
            if asyncio.iscoroutinefunction(self.url_analyzer.analyze):
                struct_data = await self.url_analyzer.analyze(url)
            else:
                struct_data = await asyncio.to_thread(self.url_analyzer.analyze, url)

            if not isinstance(struct_data, dict):
                return None

            required_keys = {"risk_score", "level", "flags"}
            if not required_keys.issubset(struct_data.keys()):
                return None

            return URLStructureResult(**struct_data)

        except Exception as exc:
            logger.error(f"Error construyendo URLStructureResult: {exc}")
            return None
