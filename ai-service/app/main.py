"""
BulutKlinik AI Service — FastAPI Uygulaması
============================================
Çalıştırmak için:
    uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

Swagger UI: http://localhost:8001/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analysis, photos, treatment
from app.core.config import settings
from app.core.database import init_db

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────── #
#  Uygulama yaşam döngüsü                                                      #
# ─────────────────────────────────────────────────────────────────────────── #

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BulutKlinik AI Service başlatılıyor…")
    await init_db()
    logger.info("Veritabanı hazır.")
    yield
    logger.info("BulutKlinik AI Service kapatılıyor…")


# ─────────────────────────────────────────────────────────────────────────── #
#  FastAPI uygulaması                                                          #
# ─────────────────────────────────────────────────────────────────────────── #

app = FastAPI(
    title       = settings.APP_NAME,
    version     = settings.APP_VERSION,
    description = (
        "Medikal estetik klinikleri için **Yapay Zeka Destekli Yüz Asimetri Analizi**.\n\n"
        "- **OpenCV + MediaPipe** ile landmark tespiti ve asimetri ölçümü\n"
        "- **OpenAI GPT-4o** ile profesyonel klinik rapor üretimi\n"
        "- **Enjeksiyon Haritası** ve doktor onay akışı"
    ),
    lifespan    = lifespan,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS ────────────────────────────────────────────────────────────────── #
app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.CORS_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Router'lar ───────────────────────────────────────────────────────────── #
app.include_router(photos.router,   prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(treatment.router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────── #
#  Global exception handler                                                    #
# ─────────────────────────────────────────────────────────────────────────── #

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    logger.exception("İşlenmeyen hata: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Beklenmeyen bir sunucu hatası oluştu.", "code": "INTERNAL_ERROR"},
    )


# ── Sağlık kontrolü ──────────────────────────────────────────────────────── #

@app.get("/health", tags=["Health"], summary="Servis sağlık kontrolü")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME, "version": settings.APP_VERSION}
