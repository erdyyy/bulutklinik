"""
BulutKlinik AI Servis — Veritabanı Şeması
==========================================
Tablolar:
  patient_photos       — Yüklenen yüz fotoğrafları
  asymmetry_analyses   — OpenCV asimetri analiz sonuçları
  injection_mappings   — Doktorun işaretlediği enjeksiyon noktaları
  treatment_plans      — AI tarafından üretilen klinik tedavi planları
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────────────────── #
#  Enum tanımları                                                              #
# ─────────────────────────────────────────────────────────────────────────── #

class PhotoType(str, enum.Enum):
    BEFORE   = "before"
    AFTER    = "after"
    ANALYSIS = "analysis"


class FaceRegion(str, enum.Enum):
    EYEBROW   = "eyebrow"
    EYE       = "eye"
    LIP       = "lip"
    NOSE      = "nose"
    CHEEK     = "cheek"
    JAW       = "jaw"
    FOREHEAD  = "forehead"


class AnalysisStatus(str, enum.Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"


# ─────────────────────────────────────────────────────────────────────────── #
#  patient_photos                                                              #
# ─────────────────────────────────────────────────────────────────────────── #

class PatientPhoto(Base):
    """
    Hastaya ait yüz fotoğrafı kaydı.
    patient_id ve doctor_id C# backend'deki Users tablosuna işaret eder
    (cross-service FK — uygulama katmanında doğrulanır).
    """
    __tablename__ = "patient_photos"

    id         = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False, index=True)
    doctor_id  = Column(Integer, nullable=False, index=True)

    photo_type = Column(SQLEnum(PhotoType), default=PhotoType.BEFORE, nullable=False)

    # Dosya meta
    file_path  = Column(String(500), nullable=False)
    file_name  = Column(String(255), nullable=False)
    file_size  = Column(Integer)          # bytes
    mime_type  = Column(String(100))
    width      = Column(Integer)          # pixel
    height     = Column(Integer)          # pixel

    # Soft-delete
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # İlişkiler
    analyses = relationship(
        "AsymmetryAnalysis",
        back_populates="photo",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_patient_photos_patient_doctor", "patient_id", "doctor_id"),
    )


# ─────────────────────────────────────────────────────────────────────────── #
#  asymmetry_analyses                                                          #
# ─────────────────────────────────────────────────────────────────────────── #

class AsymmetryAnalysis(Base):
    """
    Tek bir fotoğraf için OpenCV + MediaPipe analiz sonuçları.
    Tüm mesafe değerleri mm cinsindendir (IPD kalibrasyonuyla dönüştürülür).
    Pozitif değer → sol taraf, negatif → sağ taraf dominantlığını gösterir.
    """
    __tablename__ = "asymmetry_analyses"

    id         = Column(Integer, primary_key=True, index=True)
    photo_id   = Column(Integer, ForeignKey("patient_photos.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, nullable=False, index=True)

    # Kalibrasyon
    px_per_mm  = Column(Float)            # IPD tabanlı ölçek faktörü

    # ── Kaş asimetrisi ──────────────────────────────────────────────────── #
    eyebrow_left_height_px  = Column(Float)   # sol kaş zirvesinin göz merkezine uzaklığı (px)
    eyebrow_right_height_px = Column(Float)   # sağ kaş zirvesinin göz merkezine uzaklığı (px)
    eyebrow_delta_mm        = Column(Float)   # sol − sağ fark (mm); + → sol yüksek

    # ── Göz açıklığı ───────────────────────────────────────────────────── #
    eye_left_opening_px  = Column(Float)      # sol üst-alt kapak farkı (px)
    eye_right_opening_px = Column(Float)      # sağ üst-alt kapak farkı (px)
    eye_delta_mm         = Column(Float)      # sol − sağ fark (mm)

    # ── Dudak köşesi ───────────────────────────────────────────────────── #
    lip_left_height_px  = Column(Float)       # sol köşenin üst dudak merkezine mesafesi (px)
    lip_right_height_px = Column(Float)       # sağ köşenin üst dudak merkezine mesafesi (px)
    lip_delta_mm        = Column(Float)       # sol − sağ fark (mm)

    # ── Burun sapması ──────────────────────────────────────────────────── #
    nose_deviation_mm = Column(Float)         # yüz merkez çizgisinden kaç mm saptı

    # ── Orta hat ───────────────────────────────────────────────────────── #
    midline_deviation_mm = Column(Float)      # orta hat noktalarının ortalama sapması (mm)

    # ── Genel skor ─────────────────────────────────────────────────────── #
    symmetry_score = Column(Float)            # 0-100; 100 = mükemmel simetri

    # Annotated görüntü (opsiyonel, diskte saklanır)
    annotated_image_path  = Column(String(500))
    annotated_image_b64   = Column(Text)      # küçük önizleme için base64

    # Ham landmark koordinatları (JSON)
    landmarks_json = Column(Text)

    # İşlem durumu
    status        = Column(SQLEnum(AnalysisStatus), default=AnalysisStatus.PENDING, nullable=False)
    error_message = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # İlişkiler
    photo             = relationship("PatientPhoto", back_populates="analyses")
    injection_mappings = relationship(
        "InjectionMapping",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )
    treatment_plans = relationship(
        "TreatmentPlan",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_asymmetry_analyses_patient", "patient_id"),
    )


# ─────────────────────────────────────────────────────────────────────────── #
#  injection_mappings                                                          #
# ─────────────────────────────────────────────────────────────────────────── #

class InjectionMapping(Base):
    """
    Doktorun fotoğraf üzerinde işaretlediği enjeksiyon noktaları.
    Koordinatlar 0-1 aralığında normalleştirilmiş (orijinal görüntü boyutuna göre).
    """
    __tablename__ = "injection_mappings"

    id          = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("asymmetry_analyses.id", ondelete="CASCADE"), nullable=False)
    patient_id  = Column(Integer, nullable=False, index=True)
    doctor_id   = Column(Integer, nullable=False)

    region = Column(SQLEnum(FaceRegion), nullable=False)
    side   = Column(String(10))    # "left" | "right" | "bilateral"

    # Normalleştirilmiş koordinatlar (0.0 – 1.0)
    x_normalized = Column(Float, nullable=False)
    y_normalized = Column(Float, nullable=False)

    # Uygulanan ürün & doz bilgisi
    product_name  = Column(String(255))
    dosage_units  = Column(Float)          # örn: 0.1 mL veya 2 Ü (ünite)
    dosage_type   = Column(String(20))     # "ml" | "unit"
    product_brand = Column(String(100))

    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    analysis = relationship("AsymmetryAnalysis", back_populates="injection_mappings")


# ─────────────────────────────────────────────────────────────────────────── #
#  treatment_plans                                                             #
# ─────────────────────────────────────────────────────────────────────────── #

class TreatmentPlan(Base):
    """
    OpenAI GPT tarafından üretilen ve doktor onayına sunulan klinik tedavi planı.
    is_approved = True olmadan hasta ile paylaşılmamalıdır.
    """
    __tablename__ = "treatment_plans"

    id          = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("asymmetry_analyses.id", ondelete="CASCADE"), nullable=False)
    patient_id  = Column(Integer, nullable=False, index=True)
    doctor_id   = Column(Integer, nullable=False)

    # AI tarafından üretilen içerik (yapılandırılmış JSON olarak saklanır)
    clinical_summary       = Column(Text)          # Genel klinik değerlendirme
    regional_findings_json = Column(Text)          # JSON: [{region, finding, severity}]
    recommendations_json   = Column(Text)          # JSON: [{treatment, region, priority, notes}]
    contraindications      = Column(Text)
    patient_communication  = Column(Text)          # Hasta ile paylaşılabilecek özet
    follow_up_interval_weeks = Column(Integer, default=4)

    # OpenAI meta
    ai_model           = Column(String(100))
    prompt_tokens      = Column(Integer)
    completion_tokens  = Column(Integer)

    # Doktor onay akışı
    is_approved        = Column(Boolean, default=False, nullable=False)
    approved_by_doctor = Column(Integer)
    approved_at        = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    analysis = relationship("AsymmetryAnalysis", back_populates="treatment_plans")
