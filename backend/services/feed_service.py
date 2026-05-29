"""
Servicio de Feeds Locales de Phishing.

Descarga y mantiene en SQLite local los feeds de:
  - OpenPhish (feed.txt): actualización cada ~6h, totalmente libre.

Las consultas son O(1) por hash de URL — latencia ~0ms.
El refresco de feeds se ejecuta en background cada hora usando asyncio.

Uso:
    service = FeedService()
    await service.initialize()           # Descarga inicial
    result = await service.check_url("https://evil.com/phish")
    if result.detected:
        print(result.source)            # "OpenPhish"
"""

import asyncio
import hashlib
import logging
import os
import sqlite3
import threading
import time
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# ─── Configuración ─────────────────────────────────────────────────────────────

FEEDS_DB_NAME = os.getenv("FEEDS_DB_NAME", "phishing_feeds.db")
FEEDS_REFRESH_INTERVAL = int(os.getenv("FEEDS_REFRESH_INTERVAL_SECONDS", str(60 * 60)))  # 1 hora
FEED_DOWNLOAD_TIMEOUT = float(os.getenv("FEED_DOWNLOAD_TIMEOUT", "30.0"))
MAX_FEED_ENTRIES = int(os.getenv("MAX_FEED_ENTRIES", "500_000"))

OPENPHISH_FEED_URL = "https://openphish.com/feed.txt"

# ─── Modelos de datos ──────────────────────────────────────────────────────────

@dataclass
class FeedCheckResult:
    """Resultado de la comprobación de una URL contra los feeds locales."""
    detected: bool = False
    source: str | None = None
    url_hash: str | None = None


# ─── Servicio ──────────────────────────────────────────────────────────────────

class FeedService:
    """
    Servicio singleton que mantiene una base de datos SQLite local con feeds
    de URLs de phishing conocidas.
    """
    _instance: "FeedService | None" = None
    _initialized: bool = False
    _lock = threading.Lock()

    def __new__(cls) -> "FeedService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self._initialized = True

        self._db_path = self._resolve_db_path()
        self._refresh_task: asyncio.Task | None = None
        self._last_refresh: dict[str, float] = {}
        self._total_entries: int = 0
        self._init_db()

    @staticmethod
    def _resolve_db_path() -> str:
        """Resuelve la ruta de la base de datos de feeds."""
        docker_data_dir = "/app/data"
        base_dir = docker_data_dir if os.path.isdir(docker_data_dir) else os.getcwd()
        os.makedirs(base_dir, exist_ok=True)
        return os.path.join(base_dir, FEEDS_DB_NAME)

    def _init_db(self) -> None:
        """Inicializa el esquema de la base de datos."""
        with sqlite3.connect(self._db_path, timeout=15.0) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS phishing_feeds (
                    url_hash    TEXT PRIMARY KEY,
                    url         TEXT NOT NULL,
                    domain      TEXT NOT NULL,
                    source      TEXT NOT NULL,
                    added_at    INTEGER NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_domain ON phishing_feeds(domain)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_source ON phishing_feeds(source)")
            conn.commit()
        logger.info(f"✅ FeedService: base de datos inicializada en {self._db_path}")

    # ─── API Pública ────────────────────────────────────────────────────────────

    async def initialize(self) -> None:
        """
        Descarga inicial de todos los feeds.
        Debe llamarse una vez al arrancar la aplicación.
        """
        logger.info("📥 FeedService: descargando feeds de phishing iniciales...")
        await self._refresh_all_feeds()

    def start_background_refresh(self) -> None:
        """Inicia la tarea de refresco periódico en background."""
        if self._refresh_task and not self._refresh_task.done():
            return
        self._refresh_task = asyncio.create_task(self._background_loop())
        logger.info(f"🔄 FeedService: refresco automático cada {FEEDS_REFRESH_INTERVAL // 60} minutos.")

    async def stop(self) -> None:
        """Cancela la tarea de refresco background."""
        if self._refresh_task and not self._refresh_task.done():
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 FeedService: refresco background detenido.")

    async def check_url(self, url: str) -> FeedCheckResult:
        """
        Comprueba si una URL está en alguno de los feeds locales.

        Estrategia de búsqueda:
          1. Por hash SHA-256 exacto de la URL.
          2. Por dominio (para detectar variantes de rutas del mismo dominio).
        """
        if not url:
            return FeedCheckResult()

        url_hash = hashlib.sha256(url.encode()).hexdigest()
        domain = self._extract_domain(url)

        try:
            result = await asyncio.to_thread(self._query_db, url_hash, domain, url)
            return result
        except Exception as exc:
            logger.error(f"FeedService error comprobando {url}: {exc}")
            return FeedCheckResult()

    @property
    def total_entries(self) -> int:
        """Número total de entradas en la base de datos."""
        return self._total_entries

    # ─── Internos ───────────────────────────────────────────────────────────────

    def _query_db(self, url_hash: str, domain: str, search_url: str) -> FeedCheckResult:
        """Consulta sincrónica a la base de datos (ejecutada en thread pool)."""
        with sqlite3.connect(self._db_path, timeout=5.0) as conn:
            # 1. Búsqueda por hash exacto
            row = conn.execute(
                "SELECT source FROM phishing_feeds WHERE url_hash = ?",
                (url_hash,)
            ).fetchone()
            if row:
                return FeedCheckResult(detected=True, source=row[0], url_hash=url_hash)

            # 2. Búsqueda por dominio y coincidencia flexible (OpenPhish)
            rows = conn.execute(
                "SELECT url, source FROM phishing_feeds WHERE domain = ?",
                (domain,)
            ).fetchall()
            
            search_norm = search_url.rstrip('/').replace("https://", "http://").lower()
            for db_url, source in rows:
                db_norm = db_url.rstrip('/').replace("https://", "http://").lower()
                if search_norm == db_norm:
                    return FeedCheckResult(detected=True, source=source, url_hash=None)

        return FeedCheckResult()

    async def _background_loop(self) -> None:
        """Loop de refresco periódico que se ejecuta indefinidamente."""
        while True:
            try:
                await asyncio.sleep(FEEDS_REFRESH_INTERVAL)
                logger.info("🔄 FeedService: iniciando refresco periódico de feeds...")
                await self._refresh_all_feeds()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"FeedService error en refresco background: {exc}")

    async def _refresh_all_feeds(self) -> None:
        """Descarga y actualiza todos los feeds configurados."""
        tasks = [
            self._refresh_openphish(),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.warning(f"FeedService: error refrescando feed {i}: {r}")
        self._total_entries = await asyncio.to_thread(self._count_entries)
        logger.info(f"✅ FeedService: {self._total_entries:,} entradas totales en base de datos.")

    async def _refresh_openphish(self) -> None:
        """Descarga el feed de OpenPhish (texto plano, una URL por línea)."""
        source = "OpenPhish"
        logger.info(f"📥 Descargando {source}...")

        try:
            async with httpx.AsyncClient(timeout=FEED_DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
                response = await client.get(OPENPHISH_FEED_URL, headers={
                    "User-Agent": "PhishingScanner/2.0 (security research)"
                })
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning(f"OpenPhish descarga fallida: {exc}")
            return

        urls = [line.strip() for line in response.text.splitlines() if line.strip().startswith("http")]
        if not urls:
            logger.warning("OpenPhish: feed vacío o sin URLs válidas.")
            return

        inserted = await asyncio.to_thread(self._bulk_insert, urls, source)
        self._last_refresh[source] = time.time()
        logger.info(f"✅ OpenPhish: {inserted} nuevas entradas insertadas ({len(urls)} procesadas).")



    def _bulk_insert(self, urls: list[str], source: str) -> int:
        """
        Inserta URLs en la base de datos usando INSERT OR IGNORE para idempotencia.
        Retorna el número de filas realmente insertadas.
        Se hace en lotes para optimizar el consumo de memoria.
        """
        now = int(time.time())
        inserted_count = 0
        chunk_size = 5000

        try:
            with sqlite3.connect(self._db_path, timeout=15.0) as conn:
                for i in range(0, min(len(urls), MAX_FEED_ENTRIES), chunk_size):
                    batch = []
                    for url in urls[i:i + chunk_size]:
                        url = url.strip()
                        if not url:
                            continue
                        url_hash = hashlib.sha256(url.encode()).hexdigest()
                        domain = self._extract_domain(url)
                        batch.append((url_hash, url, domain, source, now))

                    if not batch:
                        continue

                    cursor = conn.executemany(
                        "INSERT OR IGNORE INTO phishing_feeds (url_hash, url, domain, source, added_at) VALUES (?,?,?,?,?)",
                        batch,
                    )
                    conn.commit()
                    # executemany.rowcount es el número real de filas insertadas
                    inserted_count += cursor.rowcount

                return inserted_count
        except Exception as exc:
            logger.error(f"FeedService bulk_insert error: {exc}")
            return inserted_count

    def _count_entries(self) -> int:
        """Cuenta el total de entradas en la base de datos."""
        try:
            with sqlite3.connect(self._db_path, timeout=5.0) as conn:
                return conn.execute("SELECT COUNT(*) FROM phishing_feeds").fetchone()[0]
        except Exception:
            return 0

    @staticmethod
    def _extract_domain(url: str) -> str:
        """Extrae el dominio (hostname) de una URL de forma segura."""
        try:
            parsed = urlparse(url)
            return (parsed.hostname or "").lower()
        except Exception:
            return ""
