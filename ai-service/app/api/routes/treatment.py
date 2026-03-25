"""
POST /generate-treatment-plan
==============================
Asimetri analiz sonuçlarını OpenAI'ye gönderir, klinik tedavi planı üretir.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.analysis import AsymmetryAnalysis, AnalysisStatus, TreatmentPlan
from app.schemas.analysis import (
    ErrorResponse,
    TreatmentPlanApproveRequest,
    TreatmentPlanRequest,
    TreatmentPlanResponse,
)
from app.services.ai_interpreter import AIInterpreter
from app.services.opencv_engine import AsymmetryMetrics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/treatment", tags=["Treatment Plans"])

_interpreter = AIInterpreter()


def _analysis_to_metrics(record: AsymmetryAnalysis) -> AsymmetryMetrics:
    """DB kaydından AsymmetryMetrics nesnesini yeniden oluşturur."""
    lm = json.loads(record.landmarks_json or "{}")
    return AsymmetryMetrics(
        px_per_mm               = record.px_per_mm or 1.0,
        eyebrow_left_height_px  = record.eyebrow_left_height_px or 0.0,
        eyebrow_right_height_px = record.eyebrow_right_height_px or 0.0,
        eyebrow_delta_mm        = record.eyebrow_delta_mm or 0.0,
        eye_left_opening_px     = record.eye_left_opening_px or 0.0,
        eye_right_opening_px    = record.eye_right_opening_px or 0.0,
        eye_delta_mm            = record.eye_delta_mm or 0.0,
        lip_left_height_px      = record.lip_left_height_px or 0.0,
        lip_right_height_px     = record.lip_right_height_px or 0.0,
        lip_delta_mm            = record.lip_delta_mm or 0.0,
        nose_deviation_mm       = record.nose_deviation_mm or 0.0,
        midline_deviation_mm    = record.midline_deviation_mm or 0.0,
        symmetry_score          = record.symmetry_score or 100.0,
        landmarks               = lm,
    )


@router.post(
    "/generate-treatment-plan",
    response_model=TreatmentPlanResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="AI klinik tedavi planı oluştur",
)
async def generate_treatment_plan(
    body: TreatmentPlanRequest,
    db:   AsyncSession = Depends(get_db),
) -> TreatmentPlanResponse:
    # ── Analiz kaydını getir ─────────────────────────────────────────────── #
    record: AsymmetryAnalysis | None = await db.get(AsymmetryAnalysis, body.analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analiz kaydı bulunamadı.")
    if record.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=422,
            detail=f"Analiz henüz tamamlanmadı (durum: {record.status.value}).",
        )

    # ── Fotoğraftan doctor_id al ─────────────────────────────────────────── #
    photo = await db.get(record.__class__.__mapper__.relationships["photo"].mapper.class_, record.photo_id)  # noqa: E501
    doctor_id = photo.doctor_id if photo else 0

    # ── OpenAI rapor üret ────────────────────────────────────────────────── #
    metrics = _analysis_to_metrics(record)

    try:
        result = await _interpreter.generate_clinical_report(
            metrics        = metrics,
            patient_age    = body.patient_age,
            patient_notes  = body.patient_notes,
            doctor_notes   = body.doctor_notes,
        )
    except Exception as exc:
        logger.exception("OpenAI API hatası: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="AI servisi şu anda kullanılamıyor. Lütfen tekrar deneyin.",
        )

    # ── DB'ye kaydet ─────────────────────────────────────────────────────── #
    plan = TreatmentPlan(
        analysis_id              = record.id,
        patient_id               = record.patient_id,
        doctor_id                = doctor_id,
        clinical_summary         = result.get("clinical_summary", ""),
        regional_findings_json   = json.dumps(result.get("regional_findings", []), ensure_ascii=False),
        recommendations_json     = json.dumps(result.get("recommendations", []),    ensure_ascii=False),
        contraindications        = result.get("contraindications"),
        patient_communication    = result.get("patient_communication", ""),
        follow_up_interval_weeks = result.get("follow_up_interval_weeks", 4),
        ai_model                 = result.get("ai_model", ""),
        prompt_tokens            = result.get("prompt_tokens", 0),
        completion_tokens        = result.get("completion_tokens", 0),
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)

    return _plan_to_response(plan)


@router.get(
    "/{plan_id}",
    response_model=TreatmentPlanResponse,
    summary="Tedavi planını getir",
)
async def get_treatment_plan(plan_id: int, db: AsyncSession = Depends(get_db)) -> TreatmentPlanResponse:
    plan = await db.get(TreatmentPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Tedavi planı bulunamadı.")
    return _plan_to_response(plan)


@router.patch(
    "/{plan_id}/approve",
    response_model=TreatmentPlanResponse,
    summary="Doktor onayı ver",
)
async def approve_plan(
    plan_id: int,
    body: TreatmentPlanApproveRequest,
    db:   AsyncSession = Depends(get_db),
) -> TreatmentPlanResponse:
    plan = await db.get(TreatmentPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Tedavi planı bulunamadı.")

    plan.is_approved        = True
    plan.approved_by_doctor = body.doctor_id
    plan.approved_at        = datetime.utcnow()
    await db.flush()

    return _plan_to_response(plan)


# ─────────────────────────────────────────────────────────────────────────── #
#  Yardımcı                                                                    #
# ─────────────────────────────────────────────────────────────────────────── #

def _plan_to_response(plan: TreatmentPlan) -> TreatmentPlanResponse:
    findings = json.loads(plan.regional_findings_json or "[]")
    recs     = json.loads(plan.recommendations_json   or "[]")

    return TreatmentPlanResponse(
        plan_id                  = plan.id,
        analysis_id              = plan.analysis_id,
        patient_id               = plan.patient_id,
        clinical_summary         = plan.clinical_summary or "",
        regional_findings        = findings,
        recommendations          = recs,
        contraindications        = plan.contraindications,
        patient_communication    = plan.patient_communication or "",
        follow_up_interval_weeks = plan.follow_up_interval_weeks or 4,
        ai_model                 = plan.ai_model or "",
        prompt_tokens            = plan.prompt_tokens or 0,
        completion_tokens        = plan.completion_tokens or 0,
        is_approved              = plan.is_approved,
        created_at               = plan.created_at,
    )
