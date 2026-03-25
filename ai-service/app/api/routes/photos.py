"""
POST /upload-photo
==================
Hasta fotoğrafını sunucuya yükler, meta verilerini kaydeder.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.analysis import PatientPhoto, PhotoType
from app.schemas.analysis import ErrorResponse, PhotoUploadResponse
from app.services.opencv_engine import AsymmetryEngine

router = APIRouter(prefix="/photos", tags=["Photos"])

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post(
    "/upload-photo",
    response_model=PhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}},
    summary="Hasta yüz fotoğrafı yükle",
)
async def upload_photo(
    file:       UploadFile = File(..., description="JPEG/PNG/WebP yüz fotoğrafı"),
    patient_id: int        = Form(..., gt=0),
    doctor_id:  int        = Form(..., gt=0),
    photo_type: PhotoType  = Form(PhotoType.BEFORE),
    db:         AsyncSession = Depends(get_db),
) -> PhotoUploadResponse:
    # ── MIME type kontrolü ───────────────────────────────────────────────── #
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya türü: {file.content_type}. JPEG, PNG veya WebP yükleyin.",
        )

    # ── Boyut kontrolü ───────────────────────────────────────────────────── #
    raw_data = await file.read()
    if len(raw_data) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dosya boyutu {settings.MAX_UPLOAD_SIZE_MB} MB sınırını aşıyor.",
        )

    # ── Görüntü decode & boyut okuma ─────────────────────────────────────── #
    try:
        img = AsymmetryEngine.image_from_bytes(raw_data)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Görüntü verisi okunamadı. Geçerli bir fotoğraf dosyası yükleyin.",
        )

    h, w = img.shape[:2]

    # ── Diske kaydet ─────────────────────────────────────────────────────── #
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "photo.jpg").suffix.lower() or ".jpg"
    unique_name = f"{patient_id}_{uuid.uuid4().hex}{ext}"
    file_path   = upload_dir / unique_name

    file_path.write_bytes(raw_data)

    # ── DB kaydı ─────────────────────────────────────────────────────────── #
    photo = PatientPhoto(
        patient_id = patient_id,
        doctor_id  = doctor_id,
        photo_type = photo_type,
        file_path  = str(file_path),
        file_name  = unique_name,
        file_size  = len(raw_data),
        mime_type  = file.content_type,
        width      = w,
        height     = h,
    )
    db.add(photo)
    await db.flush()
    await db.refresh(photo)

    return PhotoUploadResponse.model_validate(photo)


@router.get(
    "/{photo_id}",
    response_model=PhotoUploadResponse,
    summary="Fotoğraf meta verisini getir",
)
async def get_photo(photo_id: int, db: AsyncSession = Depends(get_db)) -> PhotoUploadResponse:
    from sqlalchemy import select

    row = await db.get(PatientPhoto, photo_id)
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="Fotoğraf bulunamadı.")
    return PhotoUploadResponse.model_validate(row)
