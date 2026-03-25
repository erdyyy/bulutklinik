"""
AsymmetryEngine
===============
MediaPipe Face Mesh (468 + iris landmark) ve OpenCV kullanarak
yüz fotoğrafından klinik asimetri metriklerini hesaplar.

Koordinat sistemi: (0, 0) = sol üst köşe, y aşağı artar.
Mesafe birimi  : mm (IPD kalibrasyonuyla piksel → mm dönüşümü).
İşaret kuralı  : pozitif delta → sol taraf dominant.
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────── #
#  MediaPipe landmark indeksleri (Face Mesh v2 — 468 + 10 iris)               #
# ─────────────────────────────────────────────────────────────────────────── #

# Kaş zirve noktaları
LM_EYEBROW_LEFT_PEAK  = 105   # sol kaş üst arkı
LM_EYEBROW_RIGHT_PEAK = 334   # sağ kaş üst arkı

# Göz iç/dış köşeleri + üst/alt kapak noktaları
LM_LEFT_EYE_INNER   = 133
LM_LEFT_EYE_OUTER   = 33
LM_LEFT_EYE_TOP     = 159
LM_LEFT_EYE_BOTTOM  = 145

LM_RIGHT_EYE_INNER  = 362
LM_RIGHT_EYE_OUTER  = 263
LM_RIGHT_EYE_TOP    = 386
LM_RIGHT_EYE_BOTTOM = 374

# Iris merkezleri (refine_landmarks=True gerektirir)
LM_LEFT_PUPIL  = 468
LM_RIGHT_PUPIL = 473

# Dudak köşeleri + üst merkez
LM_LIP_LEFT   = 61
LM_LIP_RIGHT  = 291
LM_LIP_TOP    = 13
LM_LIP_BOTTOM = 14

# Burun
LM_NOSE_TIP      = 1
LM_NOSE_BRIDGE   = 168
LM_NOSTRIL_LEFT  = 129
LM_NOSTRIL_RIGHT = 358

# Orta hat referansları (alın → çene)
LM_FOREHEAD = 10
LM_CHIN     = 152

MIDLINE_LANDMARKS = [
    10, 151, 9, 8, 168, 6, 197, 195, 5, 4,
    1, 19, 94, 2, 164, 0, 11, 12, 13, 14,
    15, 16, 17, 18, 200, 199, 175, 152,
]

# Ortalama interpupiller mesafe — kalibrasyon sabiti (mm)
MEAN_IPD_MM: float = 63.0


# ─────────────────────────────────────────────────────────────────────────── #
#  Veri sınıfları                                                              #
# ─────────────────────────────────────────────────────────────────────────── #

@dataclass
class LandmarkPoint:
    x_px: float
    y_px: float
    z_norm: float = 0.0

    def as_array(self) -> np.ndarray:
        return np.array([self.x_px, self.y_px], dtype=float)


@dataclass
class AsymmetryMetrics:
    """
    OpenCV analizinden çıkan tüm ölçümler.
    Tüm *_mm değerleri milimetre, *_px değerleri piksel cinsinden.
    """
    # Kalibrasyon
    px_per_mm: float = 1.0

    # Kaş
    eyebrow_left_height_px:  float = 0.0
    eyebrow_right_height_px: float = 0.0
    eyebrow_delta_mm:        float = 0.0   # + → sol kaş daha yüksek

    # Göz açıklığı
    eye_left_opening_px:  float = 0.0
    eye_right_opening_px: float = 0.0
    eye_delta_mm:         float = 0.0     # + → sol göz daha açık

    # Dudak köşesi
    lip_left_height_px:  float = 0.0
    lip_right_height_px: float = 0.0
    lip_delta_mm:        float = 0.0     # + → sol köşe yukarıda

    # Burun sapması
    nose_deviation_mm: float = 0.0      # + → sağa, − → sola

    # Orta hat
    midline_deviation_mm: float = 0.0

    # Genel simetri skoru (0 – 100)
    symmetry_score: float = 100.0

    # Ham landmark koordinatları (JSON için tutulur, DB'ye yazılır)
    landmarks: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("landmarks")
        return d

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)


# ─────────────────────────────────────────────────────────────────────────── #
#  Ana motor                                                                   #
# ─────────────────────────────────────────────────────────────────────────── #

class AsymmetryEngine:
    """
    Kullanım::

        with AsymmetryEngine() as engine:
            image = engine.load_image("/path/to/photo.jpg")
            metrics, annotated = engine.analyze(image)

    analyze() dönüş değerleri:
        metrics   : AsymmetryMetrics
        annotated : BGR annotasyonlu görüntü (np.ndarray)
    """

    # Annotasyon renkleri (BGR)
    _C_MIDLINE = (0,   255, 255)   # sarı
    _C_LEFT    = (0,   200, 100)   # yeşil
    _C_RIGHT   = (60,  60,  255)   # kırmızı
    _C_DELTA   = (255, 165, 0)     # turuncu
    _C_TEXT    = (220, 220, 220)   # açık gri
    _C_SCORE   = (0,   230, 0)     # parlak yeşil
    _FONT      = cv2.FONT_HERSHEY_SIMPLEX

    def __init__(
        self,
        min_detection_confidence: float = 0.70,
        refine_landmarks: bool = True,
    ) -> None:
        self._mp_fm = mp.solutions.face_mesh
        self._face_mesh = self._mp_fm.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=refine_landmarks,
            min_detection_confidence=min_detection_confidence,
        )

    # ────────────────────────────────────────────────────────────────────── #
    #  Public API                                                             #
    # ────────────────────────────────────────────────────────────────────── #

    def analyze(
        self,
        image_bgr: np.ndarray,
        pixel_per_mm: Optional[float] = None,
    ) -> tuple[AsymmetryMetrics, np.ndarray]:
        """
        Args:
            image_bgr    : BGR formatında NumPy array (cv2.imread çıktısı).
            pixel_per_mm : Harici kalibrasyon değeri. None ise IPD ile hesaplanır.

        Returns:
            (AsymmetryMetrics, annotated_bgr)

        Raises:
            ValueError: Fotoğrafta yüz bulunamazsa.
        """
        h, w = image_bgr.shape[:2]
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        result = self._face_mesh.process(rgb)
        if not result.multi_face_landmarks:
            raise ValueError(
                "Fotoğrafta yüz tespit edilemedi. "
                "Lütfen yüzün açık ve net göründüğü bir fotoğraf yükleyin."
            )

        raw_lm = result.multi_face_landmarks[0].landmark
        pts: list[LandmarkPoint] = [
            LandmarkPoint(lm.x * w, lm.y * h, lm.z)
            for lm in raw_lm
        ]

        if pixel_per_mm is None:
            pixel_per_mm = self._calibrate(pts)

        metrics  = self._compute_metrics(pts, pixel_per_mm, h, w)
        annotated = self._draw_annotations(image_bgr.copy(), pts, metrics, h, w)

        return metrics, annotated

    # ────────────────────────────────────────────────────────────────────── #
    #  Kalibrasyon                                                            #
    # ────────────────────────────────────────────────────────────────────── #

    def _calibrate(self, pts: list[LandmarkPoint]) -> float:
        """Ortalama IPD'ye göre px/mm oranını hesaplar."""
        lp = pts[LM_LEFT_PUPIL]
        rp = pts[LM_RIGHT_PUPIL]
        ipd_px = float(np.linalg.norm(lp.as_array() - rp.as_array()))
        if ipd_px < 10.0:
            logger.warning("IPD %s px çok küçük, 1.0 px/mm kullanılıyor.", ipd_px)
            return 1.0
        px_per_mm = ipd_px / MEAN_IPD_MM
        logger.debug("IPD=%.1f px → kalibrasyon=%.3f px/mm", ipd_px, px_per_mm)
        return px_per_mm

    # ────────────────────────────────────────────────────────────────────── #
    #  Metrik hesapları                                                       #
    # ────────────────────────────────────────────────────────────────────── #

    def _compute_metrics(
        self,
        pts: list[LandmarkPoint],
        px_per_mm: float,
        h: int,
        w: int,
    ) -> AsymmetryMetrics:
        m = AsymmetryMetrics(px_per_mm=round(px_per_mm, 4))

        # Referans: iki iç göz köşesinin orta noktası (x, y)
        eye_cx = (pts[LM_LEFT_EYE_INNER].x_px + pts[LM_RIGHT_EYE_INNER].x_px) / 2.0
        eye_cy = (pts[LM_LEFT_EYE_INNER].y_px + pts[LM_RIGHT_EYE_INNER].y_px) / 2.0

        # ── Kaş yüksekliği ──────────────────────────────────────────────── #
        # Kaş zirve noktasının göz merkezi y'sinden dikey uzaklığı
        # (y yukarı gidince azaldığı için eye_cy - kaş_y pozitif olur)
        m.eyebrow_left_height_px  = round(eye_cy - pts[LM_EYEBROW_LEFT_PEAK].y_px,  2)
        m.eyebrow_right_height_px = round(eye_cy - pts[LM_EYEBROW_RIGHT_PEAK].y_px, 2)
        m.eyebrow_delta_mm = round(
            (m.eyebrow_left_height_px - m.eyebrow_right_height_px) / px_per_mm, 3
        )

        # ── Göz açıklığı ────────────────────────────────────────────────── #
        m.eye_left_opening_px  = round(abs(pts[LM_LEFT_EYE_TOP].y_px  - pts[LM_LEFT_EYE_BOTTOM].y_px),  2)
        m.eye_right_opening_px = round(abs(pts[LM_RIGHT_EYE_TOP].y_px - pts[LM_RIGHT_EYE_BOTTOM].y_px), 2)
        m.eye_delta_mm = round(
            (m.eye_left_opening_px - m.eye_right_opening_px) / px_per_mm, 3
        )

        # ── Dudak köşesi ─────────────────────────────────────────────────── #
        lip_ref_y = pts[LM_LIP_TOP].y_px
        m.lip_left_height_px  = round(lip_ref_y - pts[LM_LIP_LEFT].y_px,  2)
        m.lip_right_height_px = round(lip_ref_y - pts[LM_LIP_RIGHT].y_px, 2)
        m.lip_delta_mm = round(
            (m.lip_left_height_px - m.lip_right_height_px) / px_per_mm, 3
        )

        # ── Burun sapması ────────────────────────────────────────────────── #
        nostril_cx = (pts[LM_NOSTRIL_LEFT].x_px + pts[LM_NOSTRIL_RIGHT].x_px) / 2.0
        m.nose_deviation_mm = round((nostril_cx - eye_cx) / px_per_mm, 3)

        # ── Orta hat sapması ─────────────────────────────────────────────── #
        m.midline_deviation_mm = round(
            self._midline_deviation(pts, eye_cx, px_per_mm), 3
        )

        # ── Genel simetri skoru ──────────────────────────────────────────── #
        m.symmetry_score = self._symmetry_score(m)

        # ── Landmark sözlüğü (JSON'a yazılacak) ─────────────────────────── #
        m.landmarks = self._extract_landmark_dict(pts)

        return m

    def _midline_deviation(
        self,
        pts: list[LandmarkPoint],
        face_cx: float,
        px_per_mm: float,
    ) -> float:
        valid = [pts[i] for i in MIDLINE_LANDMARKS if i < len(pts)]
        if not valid:
            return 0.0
        deviations = [p.x_px - face_cx for p in valid]
        return float(np.mean(deviations)) / px_per_mm

    def _symmetry_score(self, m: AsymmetryMetrics) -> float:
        """
        Ağırlıklı klinik simetri skoru (0 – 100).
        5 mm sapma sıfır puana karşılık gelir.
        Ağırlıklar klinik önem sırasıyla belirlenmiştir.
        """
        WEIGHTS = dict(eyebrow=0.30, eye=0.30, lip=0.20, nose=0.10, midline=0.10)
        MAX_MM  = 5.0

        def score(val_mm: float) -> float:
            return max(0.0, 100.0 * (1.0 - abs(val_mm) / MAX_MM))

        s = (
            WEIGHTS["eyebrow"] * score(m.eyebrow_delta_mm) +
            WEIGHTS["eye"]     * score(m.eye_delta_mm)     +
            WEIGHTS["lip"]     * score(m.lip_delta_mm)     +
            WEIGHTS["nose"]    * score(m.nose_deviation_mm) +
            WEIGHTS["midline"] * score(m.midline_deviation_mm)
        )
        return round(s, 1)

    def _extract_landmark_dict(self, pts: list[LandmarkPoint]) -> dict:
        def pt(i: int) -> list[float]:
            return [round(pts[i].x_px, 2), round(pts[i].y_px, 2)]

        return {
            "left_eyebrow_peak":  pt(LM_EYEBROW_LEFT_PEAK),
            "right_eyebrow_peak": pt(LM_EYEBROW_RIGHT_PEAK),
            "left_eye_top":       pt(LM_LEFT_EYE_TOP),
            "left_eye_bottom":    pt(LM_LEFT_EYE_BOTTOM),
            "right_eye_top":      pt(LM_RIGHT_EYE_TOP),
            "right_eye_bottom":   pt(LM_RIGHT_EYE_BOTTOM),
            "left_pupil":         pt(LM_LEFT_PUPIL),
            "right_pupil":        pt(LM_RIGHT_PUPIL),
            "lip_left":           pt(LM_LIP_LEFT),
            "lip_right":          pt(LM_LIP_RIGHT),
            "lip_top":            pt(LM_LIP_TOP),
            "nose_tip":           pt(LM_NOSE_TIP),
            "nostril_left":       pt(LM_NOSTRIL_LEFT),
            "nostril_right":      pt(LM_NOSTRIL_RIGHT),
            "forehead":           pt(LM_FOREHEAD),
            "chin":               pt(LM_CHIN),
        }

    # ────────────────────────────────────────────────────────────────────── #
    #  Görsel annotasyon                                                      #
    # ────────────────────────────────────────────────────────────────────── #

    def _draw_annotations(
        self,
        img: np.ndarray,
        pts: list[LandmarkPoint],
        m: AsymmetryMetrics,
        h: int,
        w: int,
    ) -> np.ndarray:
        overlay = img.copy()

        face_cx = int((pts[LM_LEFT_EYE_INNER].x_px + pts[LM_RIGHT_EYE_INNER].x_px) / 2)
        forehead_y = max(0, int(pts[LM_FOREHEAD].y_px) - 30)
        chin_y     = min(h - 1, int(pts[LM_CHIN].y_px) + 30)

        # ── Orta hat dikey çizgisi ───────────────────────────────────────── #
        cv2.line(overlay, (face_cx, forehead_y), (face_cx, chin_y),
                 self._C_MIDLINE, 2, cv2.LINE_AA)

        # ── Kaş yatay referans çizgileri ────────────────────────────────── #
        ly = int(pts[LM_EYEBROW_LEFT_PEAK].y_px)
        ry = int(pts[LM_EYEBROW_RIGHT_PEAK].y_px)
        lx = int(pts[LM_EYEBROW_LEFT_PEAK].x_px)
        rx = int(pts[LM_EYEBROW_RIGHT_PEAK].x_px)

        cv2.line(overlay, (lx - 35, ly), (lx + 35, ly), self._C_LEFT,  2, cv2.LINE_AA)
        cv2.line(overlay, (rx - 35, ry), (rx + 35, ry), self._C_RIGHT, 2, cv2.LINE_AA)

        if abs(ly - ry) > 2:
            arrow_x = face_cx + 15
            cv2.arrowedLine(
                overlay,
                (arrow_x, min(ly, ry)),
                (arrow_x, max(ly, ry)),
                self._C_DELTA, 2, tipLength=0.3,
            )

        # ── Göz kapak çizgileri ──────────────────────────────────────────── #
        for top_lm, bot_lm, col in [
            (LM_LEFT_EYE_TOP,  LM_LEFT_EYE_BOTTOM,  self._C_LEFT),
            (LM_RIGHT_EYE_TOP, LM_RIGHT_EYE_BOTTOM, self._C_RIGHT),
        ]:
            cv2.line(
                overlay,
                (int(pts[top_lm].x_px), int(pts[top_lm].y_px)),
                (int(pts[bot_lm].x_px), int(pts[bot_lm].y_px)),
                col, 1, cv2.LINE_AA,
            )

        # ── Dudak köşe noktaları ─────────────────────────────────────────── #
        for lm, col in [(LM_LIP_LEFT, self._C_LEFT), (LM_LIP_RIGHT, self._C_RIGHT)]:
            cv2.circle(overlay, (int(pts[lm].x_px), int(pts[lm].y_px)), 6, col, -1)

        # ── Burun ucu ────────────────────────────────────────────────────── #
        cv2.circle(overlay,
                   (int(pts[LM_NOSE_TIP].x_px), int(pts[LM_NOSE_TIP].y_px)),
                   5, self._C_MIDLINE, -1)

        # ── Bilgi paneli ─────────────────────────────────────────────────── #
        overlay = self._draw_info_panel(overlay, m, h, w)

        # Annotasyon + orijinal görüntü blend
        return cv2.addWeighted(overlay, 0.88, img, 0.12, 0)

    def _draw_info_panel(
        self,
        img: np.ndarray,
        m: AsymmetryMetrics,
        h: int,
        w: int,
    ) -> np.ndarray:
        """Sol üst köşeye bulanık arkaplan + ölçüm özeti çizer."""
        PW, PH = 275, 200
        px, py = 12, 12

        # Arkaplan bulanıklaştır + yarı şeffaf dikdörtgen
        roi = img[py: py + PH, px: px + PW]
        if roi.shape[0] > 0 and roi.shape[1] > 0:
            blurred = cv2.GaussianBlur(roi, (21, 21), 0)
            dark    = (blurred * 0.55).astype(np.uint8)
            img[py: py + PH, px: px + PW] = dark

        cv2.rectangle(img, (px, py), (px + PW, py + PH), (80, 80, 80), 1)

        lines = [
            ("Symmetry Score", f"{m.symmetry_score:.1f}/100", self._C_SCORE),
            ("Eyebrow Δ",      f"{m.eyebrow_delta_mm:+.2f} mm", self._C_TEXT),
            ("Eye Δ",          f"{m.eye_delta_mm:+.2f} mm",     self._C_TEXT),
            ("Lip Δ",          f"{m.lip_delta_mm:+.2f} mm",     self._C_TEXT),
            ("Nose Dev",       f"{m.nose_deviation_mm:+.2f} mm",     self._C_TEXT),
            ("Midline Dev",    f"{m.midline_deviation_mm:+.2f} mm",  self._C_TEXT),
        ]

        for i, (label, value, color) in enumerate(lines):
            y_pos = py + 30 + i * 28
            cv2.putText(img, f"{label}:", (px + 8, y_pos),
                        self._FONT, 0.44, (160, 160, 160), 1, cv2.LINE_AA)
            cv2.putText(img, value, (px + 140, y_pos),
                        self._FONT, 0.46, color, 1, cv2.LINE_AA)

        return img

    # ────────────────────────────────────────────────────────────────────── #
    #  Yardımcı araçlar                                                       #
    # ────────────────────────────────────────────────────────────────────── #

    @staticmethod
    def load_image(path: str) -> np.ndarray:
        """Diskten BGR görüntü yükler."""
        img = cv2.imread(path)
        if img is None:
            raise FileNotFoundError(f"Görüntü yüklenemedi: {path}")
        return img

    @staticmethod
    def image_from_bytes(data: bytes) -> np.ndarray:
        """Bellek tamponu (bytes) → BGR ndarray."""
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Görüntü verisi decode edilemedi.")
        return img

    @staticmethod
    def image_to_bytes(image_bgr: np.ndarray, quality: int = 88) -> bytes:
        """BGR ndarray → JPEG bytes."""
        _, buf = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()

    @staticmethod
    def image_to_base64(image_bgr: np.ndarray, quality: int = 85) -> str:
        """BGR ndarray → base64 JPEG string (data URI olmadan)."""
        raw = AsymmetryEngine.image_to_bytes(image_bgr, quality)
        return base64.b64encode(raw).decode("utf-8")

    def close(self) -> None:
        self._face_mesh.close()

    def __enter__(self) -> "AsymmetryEngine":
        return self

    def __exit__(self, *_) -> None:
        self.close()
