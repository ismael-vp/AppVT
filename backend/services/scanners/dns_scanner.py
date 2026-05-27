import asyncio
import logging
import os

import dns.asyncresolver
from dns.exception import DNSException

from models.osint_models import DNSData

logger = logging.getLogger(__name__)

DNS_TIMEOUT = float(os.getenv("DNS_SCANNER_TIMEOUT", "5.0"))

# Blacklists DNS: responden con 127.0.x.x si el dominio está listado
DNS_BLACKLISTS = {
    "spamhaus_dbl": "{domain}.dbl.spamhaus.org",
    "surbl":        "{domain}.multi.surbl.org",
}

# Significado de los códigos de respuesta de Spamhaus DBL
SPAMHAUS_CODES = {
    "127.0.1.2":  "spam domain",
    "127.0.1.4":  "phishing domain",
    "127.0.1.5":  "malware domain",
    "127.0.1.6":  "botnet C&C domain",
    "127.0.1.102": "abused legit spam",
    "127.0.1.104": "abused legit phishing",
    "127.0.1.105": "abused legit malware",
    "127.0.1.106": "abused legit botnet C&C",
}


async def _check_blacklist(domain: str, bl_template: str, bl_name: str) -> tuple[bool, list[str]]:
    """
    Consulta una blacklist DNS para un dominio.

    Returns:
        (listed: bool, details: list[str])  — detalles con el tipo de amenaza si está listado.
    """
    # Extraer solo la parte de dominio sin subdominio de tercer nivel para las blacklists
    query_domain = bl_template.format(domain=domain)
    resolver = dns.asyncresolver.Resolver()
    resolver.timeout = DNS_TIMEOUT
    resolver.lifetime = DNS_TIMEOUT

    try:
        answers = await resolver.resolve(query_domain, "A")
        ips = [str(r) for r in answers]

        # Filtrar solo las respuestas válidas 127.0.x.x (evitar falsos positivos de NXDOMAIN captive portals)
        listed_ips = [ip for ip in ips if ip.startswith("127.0.")]
        if not listed_ips:
            return False, []

        details = []
        for ip in listed_ips:
            if bl_name == "spamhaus_dbl":
                label = SPAMHAUS_CODES.get(ip, f"listado ({ip})")
                details.append(f"Spamhaus DBL: {label}")
            else:
                details.append(f"SURBL: dominio listado ({ip})")

        logger.info(f"🚫 DNS Blacklist [{bl_name}]: {domain} LISTADO → {details}")
        return True, details

    except DNSException:
        # NXDOMAIN = dominio NO listado (comportamiento esperado)
        return False, []
    except Exception as exc:
        logger.debug(f"Blacklist DNS {bl_name} error para {domain}: {exc}")
        return False, []


class DNSScanner:
    """Escáner de registros DNS de un dominio + consulta a blacklists Spamhaus/SURBL."""

    @staticmethod
    async def get_dns_info(hostname: str) -> DNSData | None:
        if not hostname:
            return None

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = DNS_TIMEOUT
        resolver.lifetime = DNS_TIMEOUT

        data = DNSData()

        # --- Registros DNS estándar + blacklists en paralelo ---
        async def _get_a():
            try:
                answers = await resolver.resolve(hostname, "A")
                return [rdata.address for rdata in answers]
            except DNSException as e:
                logger.info(f"DNS A lookup failed for {hostname}: {e}")
                return []

        async def _get_txt():
            try:
                answers = await resolver.resolve(hostname, "TXT")
                return [rdata.strings[0].decode("utf-8") for rdata in answers if rdata.strings]
            except DNSException as e:
                logger.info(f"DNS TXT lookup failed for {hostname}: {e}")
                return []

        async def _get_mx():
            try:
                answers = await resolver.resolve(hostname, "MX")
                return [str(rdata.exchange) for rdata in answers]
            except DNSException as e:
                logger.info(f"DNS MX lookup failed for {hostname}: {e}")
                return []

        # Ejecutar todo en paralelo para máxima velocidad
        results = await asyncio.gather(
            _get_a(),
            _get_txt(),
            _get_mx(),
            _check_blacklist(hostname, DNS_BLACKLISTS["spamhaus_dbl"], "spamhaus_dbl"),
            _check_blacklist(hostname, DNS_BLACKLISTS["surbl"], "surbl"),
            return_exceptions=True,
        )

        a_records, txt_records, mx_records, spamhaus_result, surbl_result = results

        if isinstance(a_records, list):
            data.a_records = a_records
        if isinstance(txt_records, list):
            data.txt_records = txt_records
        if isinstance(mx_records, list):
            data.mx_records = mx_records
            data.has_mx = len(data.mx_records) > 0

        # Procesar resultados de blacklists
        all_details: list[str] = []

        if isinstance(spamhaus_result, tuple):
            listed, details = spamhaus_result
            if listed:
                data.spamhaus_listed = True
                all_details.extend(details)

        if isinstance(surbl_result, tuple):
            listed, details = surbl_result
            if listed:
                data.surbl_listed = True
                all_details.extend(details)

        if all_details:
            data.blacklist_details = all_details

        if not data.a_records and not data.txt_records and not data.mx_records and not all_details:
            return None

        return data
