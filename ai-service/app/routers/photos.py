"""
Photo & Analysis Router
=======================
POST /api/v1/photos/upload-photo          → dosya yükle, photo_id döner
POST /api/v1/photos/analyze-asymmetry     → OpenCV analizi çalıştır
POST /api/v1/photos/generate-treatment-plan → LLM klinik rapor (Claude/OpenAI/Gemini)
"""

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.opencv_analyzer import FaceAsymmetryAnalyzer
from app.services.ai_interpreter  import generate_clinical_report, get_active_provider

router           = APIRouter(prefix="/api/v1/photos", tags=["photos"])
_store           = {}   # photo_id → {"data": bytes, "doctor_id": str}
_analysis_cache  = {}   # photo_id → { annotated_image_b64, key_landmarks_px }
_az              = FaceAsymmetryAnalyzer()

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _uuid_to_int(uid: str) -> int:
    return int(hashlib.md5(uid.encode()).hexdigest(), 16) % 10_000_000


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PhotoUploadResponse(BaseModel):
    photo_id:   str
    patient_id: int
    file_name:  str
    width:      int = 0
    height:     int = 0
    file_size:  int
    photo_type: str = "before"
    created_at: str

class AsymmetryResult(BaseModel):
    analysis_id:          int
    photo_id:             str
    patient_id:           int
    px_per_mm:            float
    eyebrow_delta_mm:     float
    eye_delta_mm:         float
    lip_delta_mm:         float
    nose_deviation_mm:    float
    midline_deviation_mm: float
    symmetry_score:       float
    annotated_image_b64:  Optional[str]
    status:               str
    created_at:           str
    pose_warnings:        List[str] = []
    pitch_deg:            Optional[float] = None
    yaw_deg:              Optional[float] = None
    roll_deg:             Optional[float] = None
    # Yeni estetik metrikler
    golden_ratio:         Optional[dict] = None
    canthal_tilt:         Optional[dict] = None
    face_shape:           Optional[dict] = None
    volume_map:           Optional[dict] = None
    wrinkle_map:          Optional[dict] = None
    nasal_metrics:        Optional[dict] = None

class RegionalFinding(BaseModel):
    region:   str
    finding:  str
    severity: str   # none | mild | moderate | severe

class Recommendation(BaseModel):
    treatment:       str
    region:          str
    target_muscle:   Optional[str] = None   # hedeflenen kas adı
    priority:        str   # high | medium | low
    estimated_units: Optional[str]
    notes:           str

class TreatmentPlanResponse(BaseModel):
    plan_id:                  int
    analysis_id:              int
    patient_id:               int
    clinical_summary:         str
    regional_findings:        List[RegionalFinding]
    recommendations:          List[Recommendation]
    contraindications:        Optional[str]
    patient_communication:    str
    follow_up_interval_weeks: int
    ai_model:                 str
    prompt_tokens:            int
    completion_tokens:        int
    is_approved:              bool
    created_at:               str
    treatment_map_b64:        Optional[str] = None   # AI tedavi haritası görüntüsü
    treatment_pins:           Optional[List[dict]] = None  # HTML tooltip için pin koordinatları

class TreatmentPlanRequest(BaseModel):
    photo_id:             str
    patient_id:           int
    metrics:              dict
    doctor_notes:         Optional[str] = None
    annotated_image_b64:  Optional[str] = None
    profile_image_b64:    Optional[str] = None   # Lateral/profil görüntü
    patient_age:          Optional[int] = None   # Yaşa göre norm kalibrasyonu


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/test-image")
def test_image():
    """Geliştirme ortamı için örnek yüz fotoğrafı döner."""
    path = Path("/tmp/test_face.jpg")
    if not path.exists():
        raise HTTPException(404, "Test fotoğrafı bulunamadı.")
    return FileResponse(path, media_type="image/jpeg", filename="test_face.jpg")


@router.post("/upload-photo", response_model=PhotoUploadResponse)
async def upload_photo(
    file:       UploadFile = File(...),
    patient_id: int        = Form(0),
    doctor_id:  str        = Form("0"),   # NaN gelebilir, str olarak al
    photo_type: str        = Form("before"),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Sadece JPEG, PNG veya WebP yüklenebilir.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Dosya 10 MB'ı aşıyor.")

    pid = str(uuid.uuid4())
    _store[pid] = {"data": data, "doctor_id": str(doctor_id)}

    return PhotoUploadResponse(
        photo_id   = pid,
        patient_id = patient_id,
        file_name  = file.filename or "photo",
        file_size  = len(data),
        photo_type = photo_type,
        created_at = _now(),
    )


@router.post("/analyze-asymmetry", response_model=AsymmetryResult)
async def analyze_asymmetry(
    photo_id:   str = Form(...),
    patient_id: int = Form(0),
):
    entry = _store.get(photo_id)
    if entry is None:
        raise HTTPException(404, f"photo_id '{photo_id}' bulunamadı.")
    data      = entry["data"] if isinstance(entry, dict) else entry
    doctor_id = entry.get("doctor_id", "0") if isinstance(entry, dict) else "0"

    r = _az.analyze(data)
    m = r.metrics

    # midline açısını mm sapmaya dönüştür (yaklaşık: tan(açı) × yüz yüksekliği / 2)
    import math
    midline_mm = round(math.tan(math.radians(abs(m.midline_angle_deg))) * (m.image_height / 2) / m.px_per_mm, 2)

    # Analiz sonucunu ileride tedavi haritası için cache'le
    _analysis_cache[photo_id] = {
        "annotated_image_b64": r.annotated_image_b64,
        "key_landmarks_px":    r.key_landmarks_px,
    }

    def _dc(obj):
        """dataclass → dict, None-safe."""
        if obj is None:
            return None
        from dataclasses import asdict
        try:
            return asdict(obj)
        except Exception:
            return None

    pose = m.head_pose
    result_obj = AsymmetryResult(
        analysis_id          = _uuid_to_int(photo_id),
        photo_id             = photo_id,
        patient_id           = patient_id,
        px_per_mm            = m.px_per_mm,
        eyebrow_delta_mm     = m.brow_height_diff_mm,
        eye_delta_mm         = m.eye_width_diff_mm,
        lip_delta_mm         = m.mouth_corner_diff_mm,
        nose_deviation_mm    = r.nasal_metrics.dorsum_deviation_mm if r.nasal_metrics else 0.0,
        midline_deviation_mm = midline_mm,
        symmetry_score       = m.symmetry_score,
        annotated_image_b64  = r.annotated_image_b64 or None,
        status               = "warning" if (r.error or r.pose_warnings) else "completed",
        pose_warnings        = r.pose_warnings,
        pitch_deg            = pose.pitch_deg if pose else None,
        yaw_deg              = pose.yaw_deg   if pose else None,
        roll_deg             = pose.roll_deg  if pose else None,
        created_at           = _now(),
        golden_ratio         = _dc(r.golden_ratio),
        canthal_tilt         = _dc(r.canthal_tilt),
        face_shape           = _dc(r.face_shape),
        volume_map           = _dc(r.volume_map),
        wrinkle_map          = _dc(r.wrinkle_map),
        nasal_metrics        = _dc(r.nasal_metrics),
    )
    # ── Webhook tetikle (arka planda) ──────────────────────────────────────────
    import asyncio
    try:
        from app.routers.integration import trigger_analysis_webhook
        asyncio.ensure_future(trigger_analysis_webhook(doctor_id, {
            "analysis_id":          result_obj.analysis_id,
            "patient_id":           result_obj.patient_id,
            "symmetry_score":       result_obj.symmetry_score,
            "eyebrow_delta_mm":     result_obj.eyebrow_delta_mm,
            "lip_delta_mm":         result_obj.lip_delta_mm,
            "midline_deviation_mm": result_obj.midline_deviation_mm,
            "status":               result_obj.status,
            "created_at":           result_obj.created_at,
        }))
    except Exception:
        pass
    return result_obj


@router.post("/generate-treatment-plan", response_model=TreatmentPlanResponse)
async def generate_treatment_plan(body: TreatmentPlanRequest):
    import json, re
    from app.services.opencv_analyzer import FaceAsymmetryAnalyzer as _FA

    analysis_id = _uuid_to_int(body.photo_id)
    plan_id     = _uuid_to_int(body.photo_id + "plan")

    raw = await generate_clinical_report(
        body.metrics, body.patient_id, body.doctor_notes,
        body.annotated_image_b64, body.profile_image_b64, body.patient_age
    )

    active_model = get_active_provider()

    # API anahtarı yapılandırılmamışsa fallback
    if raw is None:
        return TreatmentPlanResponse(
            plan_id=plan_id, analysis_id=analysis_id, patient_id=body.patient_id,
            clinical_summary="LLM API anahtarı yapılandırılmamış. Klinik rapor üretilemedi.",
            regional_findings=[], recommendations=[], contraindications=None,
            patient_communication="Lütfen doktorunuzla görüşün.",
            follow_up_interval_weeks=4, ai_model="unavailable",
            prompt_tokens=0, completion_tokens=0, is_approved=False, created_at=_now(),
        )

    # ── LLM çıktısından JSON çıkar ──────────────────────────────────────────────
    # Strateji 1: Direkt parse (Gemini JSON mode veya temiz çıktı)
    # Strateji 2: ```json ... ``` bloğunu çıkar
    # Strateji 3: İlk { ... } bloğunu bul (en geniş eşleşme)
    def _extract_json(text: str) -> Optional[dict]:
        text = text.strip()
        # Strateji 1: Direkt
        try:
            return json.loads(text)
        except Exception:
            pass
        # Strateji 2: Markdown kod bloğu içinden
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
        # Strateji 3: İlk { ... } geniş eşleşme
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
        return None

    parsed = _extract_json(raw)

    # JSON parse başarılıysa zengin yapıyı kullan, değilse düz metni paketle
    if parsed:
        findings = [RegionalFinding(**f) for f in parsed.get("regional_findings", [])]
        recs     = [Recommendation(**r)  for r in parsed.get("recommendations", [])]
        summary  = parsed.get("clinical_summary", raw[:400])
        patient_comm = parsed.get("patient_communication", "")
        contraind    = parsed.get("contraindications")
        fw           = int(parsed.get("follow_up_interval_weeks", 4))
    else:
        # Parse tamamen başarısızsa temiz hata mesajı göster
        findings = []
        recs     = []
        summary  = "Rapor işlenemedi. Lütfen tekrar deneyin."
        patient_comm = ""
        contraind    = None
        fw = 4

    # Token sayısı (yaklaşık — karakter / 4)
    prompt_tok    = len(body.metrics.__repr__()) // 4
    completion_tok = len(raw) // 4

    # ── Tedavi Haritası Görseli ──────────────────────────────────────────────
    treatment_map_b64: Optional[str] = None
    treatment_pins:    Optional[list] = None
    if recs:
        cached       = _analysis_cache.get(body.photo_id)
        base_img_b64 = (cached.get("annotated_image_b64") if cached else body.annotated_image_b64)
        key_lm       = (cached.get("key_landmarks_px", {}) if cached else {}) or {}

        # Cache miss durumunda görüntüyü yeniden analiz ederek landmark'ları kurtar
        if base_img_b64 and not key_lm:
            try:
                import base64 as _b64
                img_bytes  = _b64.b64decode(base_img_b64)
                re_result  = _az.analyze(img_bytes)
                key_lm     = re_result.key_landmarks_px or {}
                # Tekrar cache'e yaz
                if key_lm:
                    _analysis_cache[body.photo_id] = {
                        "annotated_image_b64": base_img_b64,
                        "key_landmarks_px":    key_lm,
                    }
            except Exception:
                pass  # yeniden analiz başarısız — key_lm boş kalır

        if base_img_b64:
            try:
                recs_dicts = [r.dict() for r in recs]
                treatment_map_b64, treatment_pins = _FA.draw_treatment_map(
                    base_img_b64, key_lm, recs_dicts
                )
            except Exception as e:
                import traceback
                print(f"[treatment_map ERROR] {e}\n{traceback.format_exc()}")
                treatment_map_b64 = None  # hata olursa sessizce geç

    plan_resp = TreatmentPlanResponse(
        plan_id=plan_id, analysis_id=analysis_id, patient_id=body.patient_id,
        clinical_summary=summary, regional_findings=findings,
        recommendations=recs, contraindications=contraind,
        patient_communication=patient_comm,
        follow_up_interval_weeks=fw,
        ai_model=active_model, prompt_tokens=prompt_tok, completion_tokens=completion_tok,
        is_approved=False, created_at=_now(),
        treatment_map_b64=treatment_map_b64,
        treatment_pins=treatment_pins,
    )
    # ── Webhook tetikle ────────────────────────────────────────────────────────
    _entry2 = _store.get(body.photo_id, {})
    _doc_id  = _entry2.get("doctor_id", "0") if isinstance(_entry2, dict) else "0"
    import asyncio
    try:
        from app.routers.integration import trigger_plan_webhook
        asyncio.ensure_future(trigger_plan_webhook(_doc_id, {
            "plan_id":                plan_resp.plan_id,
            "analysis_id":            plan_resp.analysis_id,
            "patient_id":             plan_resp.patient_id,
            "recommendation_count":   len(recs),
            "follow_up_weeks":        fw,
            "ai_model":               active_model,
            "created_at":             plan_resp.created_at,
        }))
    except Exception:
        pass
    return plan_resp
