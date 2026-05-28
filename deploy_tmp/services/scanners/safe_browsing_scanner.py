"""
Google Safe Browsing API v4 Scanner.

Consulta la API de Google Safe Browsing para detectar URLs maliciosas.
- Cuota gratuita: 10.000 requests/día.
- Detecta: MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION.
- Falla silenciosamente si GOOGLE_SAFE_BROWSING_API_KEY no está configurada.
"""

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

GSB_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
GSB_TIMEOUT = 6.0

THREAT_TYPES = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]


@dataclass
class SafeBrowsingResult:
    """Resultado de la consulta a Google Safe Browsing."""
    is_threat: bool = False
    threat_types: list[str] = field(default_factory=list)
    platform_types: list[str] = field(default_factory=list)
    checked: bool = False  # False si no hay API key o hubo error de red


class SafeBrowsingScanner:
    """Scanner que consulta la API v4 de Google Safe Browsing."""

    # M-10: Cliente compartido con pool de conexiones — evita TLS handshake por cada petición
    _client: httpx.AsyncClient | None = None

    @classmethod
    def _get_client(cls) -> httpx.AsyncClient:
        if cls._client is None or cls._client.is_closed:
            cls._client = httpx.AsyncClient(timeout=GSB_TIMEOUT)
        return cls._client

    @classmethod
    async def close_client(cls) -> None:
        """Cierra el cliente compartido al shutdown de la app."""
        if cls._client and not cls._client.is_closed:
            await cls._client.aclose()
            cls._client = None

    @staticmethod
    async def check_url(url: str, api_key: str | None) -> SafeBrowsingResult:
        """
        Comprueba una URL contra Google Safe Browsing.

        Args:
            url:     URL a analizar.
            api_key: Clave de API de Google Safe Browsing. Si es None, devuelve
                     un resultado vacío (degradación elegante).

        Returns:
            SafeBrowsingResult con los detalles de la amenaza detectada, si la hay.
        """
        if not api_key:
            logger.debug("Google Safe Browsing desactivado: GOOGLE_SAFE_BROWSING_API_KEY no configurada.")
            return SafeBrowsingResult(checked=False)

        payload = {
            "client": {
                "clientId": "PhishingScanner",
                "clientVersion": "2.0",
            },
            "threatInfo": {
                "threatTypes": THREAT_TYPES,
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }

        try:
            client = SafeBrowsingScanner._get_client()
            response = await client.post(
                GSB_API_URL,
                params={"key": api_key},
                json=payload,
            )

            if response.status_code == 200:
                data = response.json()
                matches = data.get("matches", [])

                if not matches:
                    return SafeBrowsingResult(is_threat=False, checked=True)

                threat_types = list({m.get("threatType", "") for m in matches if m.get("threatType")})
                platform_types = list({m.get("platformType", "") for m in matches if m.get("platformType")})

                logger.warning(
                    f"🚨 Google Safe Browsing: AMENAZA detectada en {url} | "
                    f"Tipos: {threat_types}"
                )
                return SafeBrowsingResult(
                    is_threat=True,
                    threat_types=threat_types,
                    platform_types=platform_types,
                    checked=True,
                )

            elif response.status_code == 400:
                logger.error(f"GSB error 400 (Bad Request) para {url}: {response.text[:200]}")
                return SafeBrowsingResult(checked=False)

            elif response.status_code == 403:
                logger.error("GSB error 403: API key inválida o cuota agotada.")
                return SafeBrowsingResult(checked=False)

            else:
                logger.warning(f"GSB respuesta inesperada {response.status_code} para {url}")
                return SafeBrowsingResult(checked=False)

        except httpx.TimeoutException:
            logger.warning(f"GSB timeout para {url}")
            return SafeBrowsingResult(checked=False)
        except httpx.RequestError as exc:
            logger.warning(f"GSB error de red para {url}: {exc}")
            return SafeBrowsingResult(checked=False)
        except Exception as exc:
            logger.error(f"GSB error inesperado para {url}: {exc}", exc_info=True)
            return SafeBrowsingResult(checked=False)
