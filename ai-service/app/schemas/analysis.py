"""
Pydantic v2 şemaları — API request / response modelleri.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────── #
#  Fotoğraf yükleme                                                            #
# ─────────────────────────────────────────────────────────────────────────── #

class PhotoUploadResponse(BaseModel):
    photo_id:   int
    patient_id: int
    file_name:  str
    width:      int
    height:     int
    file_size:  int
    photo_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────── #
#  Asimetri analizi                                                            #
# ─────────────────────────────────────────────────────────────────────────── #

class AnalysisRequest(BaseModel):
    photo_id:      int
    pixel_per_mm:  Optional[float] = Field(None, gt=0, description="Harici kalibrasyon (opsiyonel)")

    @field_validator("pixel_per_mm")
    @classmethod
    def reasonable_scale(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0.5 or v > 50.0):
            raise ValueError("pixel_per_mm değeri 0.5 – 50 arasında olmalıdır.")
        return v


class AsymmetryResult(BaseModel):
    analysis_id: int
    photo_id:    int
    patient_id:  int

    # Kalibrasyon
    px_per_mm: float

    # Kaş
    eyebrow_left_height_px:  float
    eyebrow_right_height_px: float
    eyebrow_delta_mm:        float

    # Göz
    eye_left_opening_px:  float
    eye_right_opening_px: float
    eye_delta_mm:         float

    # Dudak
    lip_left_height_px:  float
    lip_right_height_px: float
    lip_delta_mm:        float

    # Burun
    nose_deviation_mm: float

    # Orta hat
    midline_deviation_mm: float

    # Genel skor
    symmetry_score: float

    # Annotated görüntü base64 (opsiyonel — büyük payload)
    annotated_image_b64: Optional[str] = None

    status:     str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────── #
#  Tedavi planı                                                                #
# ─────────────────────────────────────────────────────────────────────────── #

class TreatmentPlanRequest(BaseModel):
    analysis_id:  int
    patient_age:  Optional[int]  = Field(None, ge=18, le=100)
    patient_notes: Optional[str] = Field(None, max_length=1000)
    doctor_notes:  Optional[str] = Field(None, max_length=1000)


class RegionalFinding(BaseModel):
    region:   str
    finding:  str
    severity: str   # none | mild | moderate | severe


class Recommendation(BaseModel):
    treatment:        str
    region:           str
    priority:         str   # high | medium | low
    estimated_units:  Optional[str] = None
    notes:            str


class TreatmentPlanResponse(BaseModel):
    plan_id:    int
    analysis_id: int
    patient_id: int

    clinical_summary:          str
    regional_findings:         list[RegionalFinding]
    recommendations:           list[Recommendation]
    contraindications:         Optional[str]
    patient_communication:     str
    follow_up_interval_weeks:  int

    ai_model:          str
    prompt_tokens:     int
    completion_tokens: int

    is_approved: bool
    created_at:  datetime

    model_config = {"from_attributes": True}


class TreatmentPlanApproveRequest(BaseModel):
    doctor_id: int


# ─────────────────────────────────────────────────────────────────────────── #
#  Enjeksiyon haritası                                                         #
# ─────────────────────────────────────────────────────────────────────────── #

class InjectionPointCreate(BaseModel):
    analysis_id:   int
    patient_id:    int
    doctor_id:     int
    region:        str
    side:          str = Field(..., pattern="^(left|right|bilateral)$")
    x_normalized:  float = Field(..., ge=0.0, le=1.0)
    y_normalized:  float = Field(..., ge=0.0, le=1.0)
    product_name:  Optional[str] = None
    product_brand: Optional[str] = None
    dosage_units:  Optional[float] = Field(None, gt=0)
    dosage_type:   Optional[str]  = Field(None, pattern="^(ml|unit)$")
    notes:         Optional[str]  = None


class InjectionPointResponse(BaseModel):
    id:            int
    analysis_id:   int
    region:        str
    side:          str
    x_normalized:  float
    y_normalized:  float
    product_name:  Optional[str]
    dosage_units:  Optional[float]
    dosage_type:   Optional[str]
    notes:         Optional[str]
    created_at:    datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────── #
#  Genel hata yanıtı                                                           #
# ─────────────────────────────────────────────────────────────────────────── #

class ErrorResponse(BaseModel):
    detail: str
    code:   Optional[str] = None
