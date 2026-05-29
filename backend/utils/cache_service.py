"""
Servicio de caché persistente para PhishingScanner.

Implementa una estrategia dual:
  - Redis (si REDIS_URL está configurado) para entornos distribuidos.
  - SQLite local como fallback universal.

La interfaz pública (get, set, check_rate_limit) es idéntica en ambos backends,
lo que permite cambiar de backend sin tocar el código cliente.
"""

import asyncio
import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", str(60 * 60 * 6)))
CACHE_MAX_DB_SIZE_BYTES = int(os.getenv("CACHE_MAX_DB_SIZE_MB", "100")) * 1024 * 1024
CACHE_DB_NAME = os.getenv("CACHE_DB_NAME", "cache.db")
REDIS_URL = os.getenv("REDIS_URL", "")


class _LocalRateLimiter:
    """Rate limiter en memoria para cuando Redis no está disponible."""

    def __init__(self):
        self._counts: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check_rate_limit(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        with self._lock:
            calls = [t for t in self._counts.get(key, []) if now - t < window]
            if len(calls) >= limit:
                return False
            calls.append(now)
            self._counts[key] = calls
            return True


class CacheService:
    """Caché unificada con backend Redis o SQLite."""

    _instance: "CacheService | None" = None
    _initialized: bool = False
    _lock = threading.Lock()

    def __new__(cls) -> "CacheService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self._initialized = True

        self._redis = None
        self._db_path = self._resolve_db_path()
        self._local_rate_limiter = _LocalRateLimiter()

        if REDIS_URL:
            self._try_init_redis()

        self._init_sqlite()
        logger.info(f"✅ CacheService inicializado. Backend: {'Redis' if self._redis else 'SQLite'}")

    @staticmethod
    def _resolve_db_path() -> str:
        docker_data_dir = "/app/data"
        base_dir = docker_data_dir if os.path.isdir(docker_data_dir) else os.getcwd()
        os.makedirs(base_dir, exist_ok=True)
        return os.path.join(base_dir, CACHE_DB_NAME)

    def _try_init_redis(self) -> None:
        try:
            import redis
            client = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=3, socket_timeout=3, decode_responses=True)
            client.ping()
            self._redis = client
            logger.info("✅ Redis conectado correctamente.")
        except Exception as exc:
            logger.warning(f"Redis no disponible: {exc}. Usando SQLite como fallback.")
            self._redis = None

    def _init_sqlite(self) -> None:
        with sqlite3.connect(self._db_path, timeout=15.0) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key         TEXT PRIMARY KEY,
                    value       TEXT NOT NULL,
                    cache_type  TEXT DEFAULT 'url',
                    created_at  INTEGER NOT NULL,
                    expires_at  INTEGER NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_expires ON cache(expires_at)")
            conn.commit()

    def get(self, key: str, cache_type: str = "url") -> Any:
        try:
            if self._redis:
                redis_key = f"phishscan:{cache_type}:{key}"
                value = self._redis.get(redis_key)
                if value:
                    return json.loads(value)
                return None

            with sqlite3.connect(self._db_path, timeout=5.0) as conn:
                row = conn.execute(
                    "SELECT value FROM cache WHERE key = ? AND cache_type = ? AND expires_at > ?",
                    (key, cache_type, int(time.time()))
                ).fetchone()
                if row:
                    return json.loads(row[0])
                return None
        except Exception as exc:
            logger.error(f"CacheService.get error: {exc}")
            return None

    def set(self, key: str, value: Any, cache_type: str = "url", ttl: int | None = None) -> bool:
        ttl = ttl or CACHE_TTL_SECONDS
        try:
            serialized = json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError) as exc:
            logger.error(f"CacheService: no se puede serializar el valor: {exc}")
            return False

        try:
            if self._redis:
                redis_key = f"phishscan:{cache_type}:{key}"
                self._redis.setex(redis_key, ttl, serialized)
                return True

            now = int(time.time())
            with sqlite3.connect(self._db_path, timeout=5.0) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO cache (key, value, cache_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                    (key, serialized, cache_type, now, now + ttl)
                )
                conn.commit()

            self._check_db_size()
            return True
        except Exception as exc:
            logger.error(f"CacheService.set error: {exc}")
            return False

    def _check_db_size(self) -> None:
        """Verifica el tamaño de la BD SQLite y aplica limpieza si supera el umbral."""
        try:
            file_size = os.path.getsize(self._db_path)
            if file_size > CACHE_MAX_DB_SIZE_BYTES:
                logger.warning(f"CacheService: BD demasiado grande ({file_size / (1024**2):.1f} MB). Limpiando...")
                self._cleanup_old_entries()
        except Exception as exc:
            logger.warning(f"CacheService error comprobando tamaño de BD: {exc}")

    def _cleanup_old_entries(self) -> None:
        """Elimina entradas expiradas y compacta la BD (VACUUM en conexión separada)."""
        try:
            with sqlite3.connect(self._db_path, timeout=15.0) as conn:
                deleted = conn.execute(
                    "DELETE FROM cache WHERE expires_at <= ?",
                    (int(time.time()),)
                ).rowcount
                conn.commit()
                logger.info(f"CacheService: {deleted} entradas expiradas eliminadas.")

            with sqlite3.connect(self._db_path, timeout=30.0, isolation_level=None) as conn:
                conn.execute("VACUUM")
        except Exception as exc:
            logger.error(f"CacheService error en limpieza: {exc}")

    def clear_all(self) -> bool:
        """Elimina todas las entradas del caché."""
        try:
            if self._redis:
                pattern = "phishscan:*"
                keys = self._redis.keys(pattern)
                if keys:
                    self._redis.delete(*keys)
                logger.info(f"CacheService: {len(keys)} entradas eliminadas de Redis.")
                return True

            with sqlite3.connect(self._db_path, timeout=15.0) as conn:
                count = conn.execute("SELECT COUNT(*) FROM cache").fetchone()[0]
                conn.execute("DELETE FROM cache")
                conn.commit()

            with sqlite3.connect(self._db_path, timeout=30.0, isolation_level=None) as conn:
                conn.execute("VACUUM")

            logger.info(f"CacheService: {count} entradas eliminadas de SQLite.")
            return True
        except Exception as exc:
            logger.error(f"CacheService.clear_all error: {exc}")
            return False

    def check_rate_limit(self, client_id: str, limit: int, window: int) -> bool:
        """Comprueba y actualiza el rate limit para un cliente."""
        try:
            if self._redis:
                pipe_key = f"phishscan:rl:{client_id}"
                with self._redis.pipeline() as pipe:
                    now = time.time()
                    window_start = now - window
                    pipe.zremrangebyscore(pipe_key, 0, window_start)
                    pipe.zadd(pipe_key, {str(now): now})
                    pipe.zcard(pipe_key)
                    pipe.expire(pipe_key, window)
                    _, _, count, _ = pipe.execute()
                    return count <= limit

            return self._local_rate_limiter.check_rate_limit(client_id, limit, window)

        except Exception as exc:
            logger.warning(f"CacheService rate limit error (fallback permissive): {exc}")
            return self._local_rate_limiter.check_rate_limit(client_id, limit, window)
