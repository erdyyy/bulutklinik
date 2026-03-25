"""
BulutKlinik AI Service
======================
FastAPI uygulaması — port 8001
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.photos       import router as photos_router
from app.routers.integration  import router as integration_router

# ── Uygulama ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BulutKlinik AI Service",
    description="Yüz asimetri analizi ve klinik rapor üretimi",
    version="1.0.0",
    docs_url="/docs",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router ────────────────────────────────────────────────────────────────────

app.include_router(photos_router)
app.include_router(integration_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "bulutklinik-ai"}
