"""
POST /analyze-asymmetry
=======================
Yüklenen fotoğraf için OpenCV + MediaPipe asimetri analizi çalıştırır.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.analysis import AnalysisStatus, AsymmetryAnalysis, InjectionMapping, PatientPhoto
from app.schemas.analysis import (
    AnalysisRequest,
    AsymmetryResult,
    ErrorResponse,
    InjectionPointCreate,
    InjectionPointResponse,
)
from app.services.opencv_engine import AsymmetryEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.post(
    "/analyze-asymmetry",
    response_model=AsymmetryResult,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Yüz asimetri analizi çalıştır",
)
async def analyze_asymmetry(
    body: AnalysisRequest,
    db:   AsyncSession = Depends(get_db),
) -> AsymmetryResult:
    # ── Fotoğrafı getir ──────────────────────────────────────────────────── #
    photo: PatientPhoto | None = await db.get(PatientPhoto, body.photo_id)
    if not photo or not photo.is_active:
        raise HTTPException(status_code=404, detail="Fotoğraf bulunamadı.")

    # ── Analiz kaydı oluştur (PROCESSING) ───────────────────────────────── #
    record = AsymmetryAnalysis(
        photo_id   = photo.id,
        patient_id = photo.patient_id,
        status     = AnalysisStatus.PROCESSING,
    )
    db.add(record)
    await db.flush()

    try:
        # ── Görüntü yükle ────────────────────────────────────────────────── #
        img = AsymmetryEngine.load_image(photo.file_path)

        # ── Analiz et ────────────────────────────────────────────────────── #
        with AsymmetryEngine() as engine:
            metrics, annotated = engine.analyze(img, pixel_per_mm=body.pixel_per_mm)

        # ── Annotated görüntüyü kaydet ───────────────────────────────────── #
        annotated_dir = Path(settings.ANNOTATED_DIR)
        annotated_dir.mkdir(parents=True, exist_ok=True)
        ann_name = f"ann_{photo.file_name}"
        ann_path = annotated_dir / ann_name
        ann_bytes = AsymmetryEngine.image_to_bytes(annotated)
        ann_path.write_bytes(ann_bytes)

        ann_b64 = AsymmetryEngine.image_to_base64(annotated, quality=75)

        # ── DB kaydını güncelle ──────────────────────────────────────────── #
        record.px_per_mm               = metrics.px_per_mm
        record.eyebrow_left_height_px  = metrics.eyebrow_left_height_px
        record.eyebrow_right_height_px = metrics.eyebrow_right_height_px
        record.eyebrow_delta_mm        = metrics.eyebrow_delta_mm
        record.eye_left_opening_px     = metrics.eye_left_opening_px
        record.eye_right_opening_px    = metrics.eye_right_opening_px
        record.eye_delta_mm            = metrics.eye_delta_mm
        record.lip_left_height_px      = metrics.lip_left_height_px
        record.lip_right_height_px     = metrics.lip_right_height_px
        record.lip_delta_mm            = metrics.lip_delta_mm
        record.nose_deviation_mm       = metrics.nose_deviation_mm
        record.midline_deviation_mm    = metrics.midline_deviation_mm
        record.symmetry_score          = metrics.symmetry_score
        record.landmarks_json          = json.dumps(metrics.landmarks)
        record.annotated_image_path    = str(ann_path)
        record.annotated_image_b64     = ann_b64
        record.status                  = AnalysisStatus.COMPLETED

    except ValueError as exc:
        record.status        = AnalysisStatus.FAILED
        record.error_message = str(exc)
        await db.flush()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    except Exception as exc:
        logger.exception("Analiz sırasında beklenmeyen hata: %s", exc)
        record.status        = AnalysisStatus.FAILED
        record.error_message = str(exc)
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analiz sırasında sunucu hatası oluştu.",
        )

    await db.refresh(record)
    return AsymmetryResult.model_validate(record)


@router.get(
    "/{analysis_id}",
    response_model=AsymmetryResult,
    summary="Analiz sonucunu getir",
)
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)) -> AsymmetryResult:
    record = await db.get(AsymmetryAnalysis, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analiz kaydı bulunamadı.")
    return AsymmetryResult.model_validate(record)


# ─────────────────────────────────────────────────────────────────────────── #
#  Enjeksiyon noktaları                                                        #
# ─────────────────────────────────────────────────────────────────────────── #

@router.post(
    "/{analysis_id}/injection-points",
    response_model=InjectionPointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enjeksiyon noktası kaydet",
)
async def add_injection_point(
    analysis_id: int,
    body: InjectionPointCreate,
    db:   AsyncSession = Depends(get_db),
) -> InjectionPointResponse:
    record = await db.get(AsymmetryAnalysis, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analiz kaydı bulunamadı.")

    point = InjectionMapping(
        analysis_id   = analysis_id,
        patient_id    = body.patient_id,
        doctor_id     = body.doctor_id,
        region        = body.region,
        side          = body.side,
        x_normalized  = body.x_normalized,
        y_normalized  = body.y_normalized,
        product_name  = body.product_name,
        product_brand = body.product_brand,
        dosage_units  = body.dosage_units,
        dosage_type   = body.dosage_type,
        notes         = body.notes,
    )
    db.add(point)
    await db.flush()
    await db.refresh(point)
    return InjectionPointResponse.model_validate(point)


@router.get(
    "/{analysis_id}/injection-points",
    response_model=list[InjectionPointResponse],
    summary="Enjeksiyon noktalarını listele",
)
async def list_injection_points(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[InjectionPointResponse]:
    from sqlalchemy import select

    rows = await db.execute(
        select(InjectionMapping).where(InjectionMapping.analysis_id == analysis_id)
    )
    return [InjectionPointResponse.model_validate(r) for r in rows.scalars()]
