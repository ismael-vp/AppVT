import asyncio
import logging
import socket
from urllib.parse import quote, urlparse

import httpx

from config import settings
from models.osint_models import OSINTResponse
from services.feed_service import FeedService
from services.image_phishing_service import ImagePhishingService
from services.ml_analyzer import analyze_osint_with_ml
from services.scanners.dns_scanner import DNSScanner
from services.scanners.form_scanner import FormScanner
from services.scanners.geo_scanner import GeoScanner
from services.scanners.heuristic_scanner import HeuristicScanner
from services.scanners.safe_browsing_scanner import SafeBrowsingScanner
from services.scanners.ssl_scanner import SSLScanner
from services.scanners.tech_scanner import TechScanner
from services.scanners.whois_scanner import WhoisScanner
from services.utils import TARGET_BRANDS, calculate_risk_level

logger = logging.getLogger(__name__)


async def _null_coro():
    """Coroutine nula: usada como placeholder en asyncio.gather cuando se omite un scanner."""
    return None

class OSINTService:

    @staticmethod
    async def get_osint_data(url: str) -> OSINTResponse:
        parsed_url = urlparse(url)
        hostname = parsed_url.hostname or (parsed_url.path.split('/')[0].split(':')[0])

        if not hostname:
            return OSINTResponse()

        osint_data = OSINTResponse()

        # Resolución DNS y Geo
        try:
            ip_address = await asyncio.wait_for(asyncio.to_thread(socket.gethostbyname, hostname), timeout=3.0)
        except Exception as e:
            logger.warning(f"Fallo de resolución DNS para {hostname}: {e}")
            ip_address = None

        T_GEO = 4.0
        T_WHOIS = 15.0
        T_SSL = 12.0
        T_DNS = 5.0
        T_TECH = 20.0

        async def _safe_call(coro, timeout: float):
            try:
                return await asyncio.wait_for(coro, timeout=timeout)
            except asyncio.TimeoutError:
                logger.warning(f"Timeout en scanner (límite {timeout}s)")
                return None
            except Exception as e:
                logger.error(f"Error en scanner: {e}")
                return None

        safe_url = url if url.startswith(('http://', 'https://')) else f"https://{url}"
        encoded_url = quote(safe_url)
        ua_desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
        ua_mobile = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"

        osint_data.screenshot_desktop = f"https://api.microlink.io/?url={encoded_url}&screenshot=true&embed=screenshot.url&viewport.width=1920&viewport.height=1080&userAgent={quote(ua_desktop)}"

        async def fetch_microlink_mobile():
            microlink_url = f"https://api.microlink.io/?url={encoded_url}&screenshot=true&device=iPhone+13&userAgent={quote(ua_mobile)}"
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    response = await client.get(microlink_url)
                    if response.status_code == 200:
                        api_data = response.json().get("data", {})
                        shot_url = api_data.get("screenshot", {}).get("url")
                        ocr_brands = []
                        if shot_url:
                            try:
                                img_resp = await client.get(shot_url, timeout=5.0)
                                if img_resp.status_code == 200:
                                    ocr_svc = ImagePhishingService()
                                    ocr_text = await ocr_svc.extract_text_from_image(img_resp.content)
                                    text_lower = ocr_text.lower()
                                    ocr_brands = [b for b in TARGET_BRANDS if b in text_lower and len(b) > 3]
                            except Exception as exc:
                                logger.error(f"Error en OCR de la captura: {exc}")
                        return shot_url, list(set(ocr_brands))
            except Exception as e:
                logger.warning(f"Error en Microlink (Mobile render) para {url}: {e}")
            return None, []

        results = await asyncio.gather(
            _safe_call(GeoScanner.get_geolocation_and_reputation(ip_address), T_GEO) if ip_address else _null_coro(),
            _safe_call(WhoisScanner.get_whois(hostname), T_WHOIS),
            _safe_call(SSLScanner.get_ssl_info(hostname), T_SSL),
            _safe_call(DNSScanner.get_dns_info(hostname), T_DNS),
            _safe_call(TechScanner.get_tech_and_scripts(url, hostname), T_TECH),
            _safe_call(fetch_microlink_mobile(), 15.0),
            return_exceptions=True
        )

        processed_results = []
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"Excepción dura en gather: {r}")
                processed_results.append(None)
            else:
                processed_results.append(r)

        geo_data, whois_data, ssl_data, dns_data, tech_data, microlink_data = processed_results

        if geo_data:
            osint_data.geolocation = geo_data.geolocation
            osint_data.abuse_confidence_score = geo_data.abuse_confidence_score
            osint_data.total_reports = geo_data.total_reports

        if whois_data:
            osint_data.whois = whois_data

        if ssl_data:
            osint_data.ssl = ssl_data

        if dns_data:
            osint_data.dns = dns_data

        if tech_data:
            osint_data.tech_data = tech_data

        if microlink_data:
            shot_url, ocr_brands = microlink_data
            osint_data.screenshot_mobile = shot_url
            if ocr_brands and osint_data.tech_data:
                osint_data.tech_data.ocr_extracted_brands = ocr_brands

        if not osint_data.screenshot_mobile:
            osint_data.screenshot_mobile = f"https://api.microlink.io/?url={encoded_url}&screenshot=true&embed=screenshot.url&device=iPhone+13"

        try:
            heuristic_orchestrator = HeuristicScanner()
            heuristic_result = await heuristic_orchestrator.run_full_heuristics(
                url, hostname, osint_data=osint_data
            )
            osint_data.heuristic_result = heuristic_result

            if heuristic_result.url_anatomy:
                osint_data.url_anatomy = heuristic_result.url_anatomy

            if heuristic_result.typosquatting:
                osint_data.typosquatting = heuristic_result.typosquatting

            if osint_data.tech_data and osint_data.tech_data.html_content:
                form_data = await FormScanner.analyze_forms(
                    osint_data.tech_data.html_content,
                    hostname,
                    osint_data.url_anatomy
                )
                if form_data:
                    osint_data.form_analysis = form_data
        except Exception as e:
            logger.error(f"Error en Heuristic Facade: {e}")

        try:
            feed_result = await FeedService().check_url(url)
            if feed_result.detected:
                osint_data.feed_detected = True
                osint_data.feed_source = feed_result.source
                logger.info(f"🎣 Feed local: {url} detectada en {feed_result.source}")
        except Exception as exc:
            logger.warning(f"FeedService check_url error: {exc}")

        dns_blacklisted = (
            osint_data.dns is not None
            and (osint_data.dns.spamhaus_listed or osint_data.dns.surbl_listed)
        )
        already_flagged = osint_data.feed_detected or dns_blacklisted

        if not already_flagged:
            try:
                gsb_result = await SafeBrowsingScanner.check_url(
                    url, settings.GOOGLE_SAFE_BROWSING_API_KEY
                )
                if gsb_result.checked:
                    osint_data.safe_browsing_checked = True
                if gsb_result.is_threat:
                    osint_data.safe_browsing_threat = True
                    osint_data.safe_browsing_types = gsb_result.threat_types
            except Exception as exc:
                logger.warning(f"SafeBrowsingScanner error: {exc}")
        else:
            logger.debug(
                f"GSB omitida para {url}: ya detectada en {'feeds' if osint_data.feed_detected else 'DNS blacklist'}"
            )

        ml_results = await asyncio.to_thread(analyze_osint_with_ml, url, osint_data)
        if ml_results["ml_score"] >= 50 and osint_data.heuristic_result:
            ml_score = ml_results["ml_score"]
            current_risk = osint_data.heuristic_result.risk_score
            new_risk = max(current_risk, ml_score) + (ml_score * 0.2 if current_risk > 30 else 0)
            osint_data.heuristic_result.risk_score = min(100, int(new_risk))
            osint_data.heuristic_result.level = calculate_risk_level(osint_data.heuristic_result.risk_score)

            if ml_results["flags"]:
                osint_data.heuristic_result.flags.extend(ml_results["flags"])

        if osint_data.tech_data:
            osint_data.tech_data.html_content = ""

        return osint_data
