import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import tldextract

from models.osint_models import (
    HeuristicResult,
    TyposquattingData,
    URLStructureResult,
)
from services.scanners.typosquatting_scanner import TyposquattingScanner
from services.scanners.url_structure_analyzer import URLStructureAnalyzer
from services.utils import TARGET_BRANDS, calculate_risk_level

BRAND_LEGITIMATE_OWNERS: dict[str, set[str]] = {
    # Google ecosystem
    "gmail":      {"google", "gmail", "googlemail"},
    "youtube":    {"google", "youtube"},
    "maps":       {"google"},
    "drive":      {"google"},
    "docs":       {"google"},
    "chrome":     {"google"},
    "android":    {"google"},
    "google":     {"google"},
    # Microsoft ecosystem
    "outlook":    {"microsoft", "outlook", "live", "hotmail", "office"},
    "teams":      {"microsoft"},
    "onedrive":   {"microsoft"},
    "azure":      {"microsoft", "azure"},
    "bing":       {"microsoft", "bing"},
    "microsoft":  {"microsoft"},
    # Meta ecosystem
    "instagram":  {"instagram", "facebook", "meta"},
    "whatsapp":   {"whatsapp", "facebook", "meta"},
    "messenger":  {"facebook", "meta"},
    "facebook":   {"facebook", "meta"},
    # Apple ecosystem
    "icloud":     {"apple", "icloud"},
    "apple":      {"apple"},
    # Amazon ecosystem
    "aws":        {"amazon", "aws"},
    "amazon":     {"amazon"},
    # LinkedIn / Microsoft
    "linkedin":   {"linkedin", "microsoft"},
    # Twitter/X
    "twitter":    {"twitter", "x"},
    "x":          {"twitter", "x"},
    # Binance
    "binance":    {"binance"},
}

logger = logging.getLogger(__name__)

MAX_RISK_SCORE = 100
MIN_RISK_SCORE = 0

TYPOSQUATTING_BASE_PENALTY = 30
TYPOSQUATTING_MAX_PENALTY = 55

def _extract_hostname(url: str) -> str:
    """Extrae y valida el hostname de una URL."""
    parsed = urlparse(url)
    if not parsed.hostname:
        raise ValueError(f"No se pudo extraer hostname de la URL: {url}")
    return parsed.hostname.lower()

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
                logger.debug(f"Ofuscación JS detectada en {extracted_hostname} - ignorado para puntaje heurístico")

            if osint_data.tech_data.anti_bot_detected:
                logger.debug(f"Anti-Bot detectado en {extracted_hostname} - ignorado para puntaje heurístico")

            if osint_data.tech_data.ocr_extracted_brands:
                html_lower = osint_data.tech_data.html_content.lower() if osint_data.tech_data.html_content else ""
                has_login_indicators = (
                    'type="password"' in html_lower
                    or "type='password'" in html_lower
                    or ("password" in html_lower and "<form" in html_lower)
                )

                extracted = tldextract.extract(extracted_hostname)
                scanned_domain = extracted.domain.lower()

                for raw_brand in osint_data.tech_data.ocr_extracted_brands:
                    brand_clean = raw_brand.strip()
                    brand_lower = brand_clean.lower()
                    official_domain = TARGET_BRANDS.get(brand_lower, brand_clean)

                    if scanned_domain == brand_lower:
                        continue

                    legitimate_owners = BRAND_LEGITIMATE_OWNERS.get(brand_lower, set())
                    if scanned_domain in legitimate_owners:
                        continue

                    if official_domain and official_domain in extracted_hostname:
                        continue

                    if has_login_indicators:
                        base_score += 85
                        flags.append(f"VISUAL_BRAND_IMPERSONATION (Marca detectada: {brand_clean.capitalize()})")
                    else:
                        logger.debug(
                            f"Marca '{brand_clean}' detectada en {extracted_hostname} sin indicadores de login — no se penaliza"
                        )

        if osint_data and osint_data.ssl:
            if osint_data.ssl.is_suspicious:
                base_score += 20
                if osint_data.ssl.cipher_suite:
                    flags.append(f"SUSPICIOUS_SSL ({osint_data.ssl.cipher_suite})")
                else:
                    flags.append("SUSPICIOUS_SSL")

        if osint_data and osint_data.geolocation and osint_data.geolocation.asn:
            suspicious_asns = ["AS4134", "AS4837", "AS5089", "AS206446"]
            if any(asn in osint_data.geolocation.asn for asn in suspicious_asns):
                base_score += 10
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
