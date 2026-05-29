import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

load_dotenv()
from config import settings  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando PhishingScanner API v2.0...")
    try:
        from utils.cache_service import CacheService
        CacheService()
        logger.info("✅ SQLite caché inicializado")
    except Exception as exc:
        logger.error(f"❌ Error inicializando caché: {exc}")
        sys.exit(1)

    # ── Inicializar FeedService (feeds locales de phishing) sin bloquear ─────
    feed_svc = None
    try:
        from services.feed_service import FeedService
        feed_svc = FeedService()

        # Lanzar inicialización en background para NO bloquear el arranque de uvicorn
        # Esto evita el error 503 en Hugging Face Spaces (Timeout de Ingress)
        async def _init_feeds():
            try:
                await feed_svc.initialize()
                logger.info(f"✅ FeedService inicializado ({feed_svc.total_entries:,} entradas en BD)")
            except Exception as exc:
                logger.warning(f"⚠️  FeedService no disponible (no crítico): {exc}")
            finally:
                feed_svc.start_background_refresh()

        asyncio.create_task(_init_feeds())
    except Exception as exc:
        logger.warning(f"⚠️  Error preparando FeedService: {exc}")

    yield

    logger.info("🛑 Apagando PhishingScanner API...")
    # Cerrar cliente HTTP compartido de GeoScanner
    try:
        from services.scanners.geo_scanner import GeoScanner  # ruta correcta (C-3)
        await GeoScanner.close_client()
    except Exception as exc:
        logger.warning(f"Error cerrando cliente HTTP GeoScanner: {exc}")

    # Detener FeedService usando la referencia guardada al arranque (C-5)
    if feed_svc is not None:
        try:
            await feed_svc.stop()
            logger.info("✅ FeedService detenido correctamente")
        except Exception as exc:
            logger.warning(f"Error deteniendo FeedService: {exc}")

    # Cerrar cliente HTTP compartido de SafeBrowsingScanner (M-10)
    try:
        from services.scanners.safe_browsing_scanner import SafeBrowsingScanner
        await SafeBrowsingScanner.close_client()
    except Exception as exc:
        logger.warning(f"Error cerrando cliente HTTP SafeBrowsingScanner: {exc}")

app = FastAPI(
    title="PhishingScanner API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# CORS restrictivo — protege cuotas de API permitiendo solo nuestros frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = f"ERR-{os.urandom(4).hex().upper()}"
    logger.error(f"[{error_id}] ERROR CRÍTICO en {request.url.path}: {type(exc).__name__}: {exc!s}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor.", "error_id": error_id},
    )

@app.get("/api/app-info", tags=["Sistema"])
async def system_info():
    """Información básica del sistema — usada por el frontend para mostrar el estado."""
    # CacheService es un singleton; instanciarlo aquí sólo valida que sigue accesible.
    all_ok = True
    try:
        from utils.cache_service import CacheService
        CacheService()  # ping implícito al singleton
    except Exception:
        all_ok = False

    return JSONResponse(
        status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "API operativa",
            "engine": "PhishingScanner Core v1.0",
            "environment": settings.ENVIRONMENT,
        },
    )

@app.get("/health", tags=["Sistema"])
async def health_check():
    """Endpoint simplificado para Healthchecks de Docker/K8s."""
    return {"status": "ok"}


@app.get("/", tags=["Sistema"])
async def root():
    """Endpoint raíz requerido por Hugging Face Spaces."""
    return RedirectResponse(url="/docs")


from api.routes import router as analyze_router  # noqa: E402 — import after app init is intentional

app.include_router(analyze_router, prefix="/api")
