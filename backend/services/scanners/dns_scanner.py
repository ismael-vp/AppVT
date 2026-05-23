import asyncio
import logging
import os
import dns.asyncresolver
from dns.exception import DNSException

from models.osint_models import DNSData

logger = logging.getLogger(__name__)

DNS_TIMEOUT = float(os.getenv("DNS_SCANNER_TIMEOUT", "5.0"))

class DNSScanner:
    """Escáner de registros DNS de un dominio usando dnspython."""

    @staticmethod
    async def get_dns_info(hostname: str) -> DNSData | None:
        if not hostname:
            return None
        
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = DNS_TIMEOUT
        resolver.lifetime = DNS_TIMEOUT

        data = DNSData()
        
        # Consultar A
        try:
            answers = await resolver.resolve(hostname, 'A')
            data.a_records = [rdata.address for rdata in answers]
        except DNSException as e:
            logger.info(f"DNS A lookup failed for {hostname}: {e}")

        # Consultar TXT
        try:
            answers = await resolver.resolve(hostname, 'TXT')
            data.txt_records = [rdata.strings[0].decode('utf-8') for rdata in answers if rdata.strings]
        except DNSException as e:
            logger.info(f"DNS TXT lookup failed for {hostname}: {e}")

        # Consultar MX
        try:
            answers = await resolver.resolve(hostname, 'MX')
            data.mx_records = [str(rdata.exchange) for rdata in answers]
            data.has_mx = len(data.mx_records) > 0
        except DNSException as e:
            logger.info(f"DNS MX lookup failed for {hostname}: {e}")

        if not data.a_records and not data.txt_records and not data.mx_records:
            return None

        return data
