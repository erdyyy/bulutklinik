"""
OpenCV + MediaPipe Yüz Asimetri Analiz Motoru
==============================================
v2 — Head pose estimation + gelişmiş görselleştirme
"""

import base64
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw, ImageFont


# ─── PIL Unicode metin yardımcısı ─────────────────────────────────────────────
_FONT_PATHS = [
    "/Library/Fonts/Arial Unicode.ttf",       # macOS
    "/System/Library/Fonts/Helvetica.ttc",    # macOS fallback
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]

def _load_pil_font(size: int) -> ImageFont.FreeTypeFont:
    for path in _FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _put_text_unicode(img: np.ndarray, text: str, pos: Tuple[int, int],
                       font_size: int, color: Tuple[int, int, int],
                       bold: bool = False) -> np.ndarray:
    """OpenCV görüntüsüne Türkçe karakter destekli metin yaz (PIL aracılığıyla)."""
    pil_img  = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw     = ImageDraw.Draw(pil_img)
    font     = _load_pil_font(font_size)
    rgb      = (color[2], color[1], color[0])  # BGR → RGB
    draw.text(pos, text, font=font, fill=rgb)
    if bold:  # 1px offset ile kalın simüle et
        draw.text((pos[0] + 1, pos[1]), text, font=font, fill=rgb)
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


# ─── MediaPipe Landmark indeksleri ────────────────────────────────────────────
class LM:
    LEFT_EYE_INNER   = 133
    LEFT_EYE_OUTER   = 33
    RIGHT_EYE_INNER  = 362
    RIGHT_EYE_OUTER  = 263
    LEFT_EYE_TOP     = 159
    LEFT_EYE_BOT     = 145
    RIGHT_EYE_TOP    = 386
    RIGHT_EYE_BOT    = 374
    LEFT_BROW_INNER  = 107
    LEFT_BROW_OUTER  = 46
    RIGHT_BROW_INNER = 336
    RIGHT_BROW_OUTER = 276
    MOUTH_LEFT       = 61
    MOUTH_RIGHT      = 291
    FOREHEAD_TOP     = 10
    CHIN_BOTTOM      = 152
    NOSE_TIP         = 4
    LEFT_PUPIL       = 468
    RIGHT_PUPIL      = 473
    # Yanak / çene referansları (head pose için)
    LEFT_CHEEK       = 234
    RIGHT_CHEEK      = 454
    LEFT_MOUTH_CORNER  = 61
    RIGHT_MOUTH_CORNER = 291


@dataclass
class HeadPose:
    pitch_deg: float   # Öne/arkaya eğim  (+: aşağı bakış, -: yukarı bakış)
    yaw_deg:   float   # Sağa/sola dönüş  (+: sola dönüş)
    roll_deg:  float   # Yana yatma       (+: sola yatma)

    @property
    def warnings(self) -> List[str]:
        w = []
        if abs(self.yaw_deg) > 12:
            w.append("Sağa döndürün" if self.yaw_deg > 0 else "Sola döndürün")
        if abs(self.pitch_deg) > 10:
            w.append("Başınızı kaldırın" if self.pitch_deg > 0 else "Başınızı indirin")
        if abs(self.roll_deg) > 10:
            w.append("Başınızı düzeltin (yana yatmış)")
        return w

    @property
    def is_acceptable(self) -> bool:
        return abs(self.yaw_deg) <= 15 and abs(self.pitch_deg) <= 12 and abs(self.roll_deg) <= 12


@dataclass
class AsymmetryMetrics:
    symmetry_score:       float
    brow_height_diff_mm:  float
    brow_height_diff_px:  float
    eye_width_diff_mm:    float
    eye_width_diff_px:    float
    mouth_corner_diff_mm: float
    mouth_corner_diff_px: float
    midline_angle_deg:    float
    ipd_px:               float
    px_per_mm:            float
    image_width:          int
    image_height:         int
    head_pose:            Optional[HeadPose] = None
    details:              dict = field(default_factory=dict)


@dataclass
class GoldenRatioMetrics:
    """Altın oran ve yüz oranları analizi."""
    facial_thirds_upper: float        # Alın (hairline→brow) / yüz yüksekliği
    facial_thirds_middle: float       # Orta (brow→nose base) / yüz yüksekliği
    facial_thirds_lower: float        # Alt (nose→chin) / yüz yüksekliği
    thirds_score: float               # 0-100: 33/33/33 idealine yakınlık
    eye_width_to_face_ratio: float    # İki göz genişliği toplamı / yüz genişliği (ideal ~0.5)
    nose_width_to_icw_ratio: float    # Burun kanat genişliği / intercanthal mesafe (ideal ~1.0)
    upper_lower_lip_ratio: float      # Üst dudak yüksekliği / alt dudak yüksekliği (ideal ~0.6)
    face_width_to_height_ratio: float # Yüz genişliği / yüz yüksekliği
    golden_ratio_score: float         # Genel altın oran skoru 0-100
    phi_deviations: dict              # Her oran için ideal değerden sapma


@dataclass
class CanthalTiltMetrics:
    """Göz canthal tilt analizi."""
    left_tilt_deg: float    # Sol göz: dış köşe - iç köşe açısı (+ yukarı, - aşağı)
    right_tilt_deg: float   # Sağ göz
    avg_tilt_deg: float     # Ortalama tilt
    tilt_symmetry_diff: float  # İki göz tilt farkı
    classification: str     # "pozitif (fox eye)", "nötr", "negatif (yorgun görünüm)"
    left_inner_px: Tuple    # Sol iç köşe koordinatı
    left_outer_px: Tuple    # Sol dış köşe koordinatı
    right_inner_px: Tuple
    right_outer_px: Tuple


@dataclass
class FaceShapeResult:
    """Yüz şekli sınıflandırması."""
    shape: str              # oval/yuvarlak/kare/kalp/elmas/dikdörtgen/üçgen
    shape_en: str           # İngilizce adı
    confidence: float       # 0-1 güven skoru
    forehead_width_mm: float
    cheekbone_width_mm: float
    jaw_width_mm: float
    face_length_mm: float
    ratios: dict            # Hesaplanan oranlar


@dataclass
class VolumeMapMetrics:
    """Yüz hacim kaybı haritası."""
    temporal_hollowing: float   # Şakak çöküklüğü skoru 0-10
    malar_fullness: float       # Elmacık dolgunluğu 0-10 (yüksek = iyi)
    tear_trough_depth: float    # Göz altı çukuru 0-10
    nasolabial_depth: float     # Nasolabial fold derinliği 0-10
    overall_volume_score: float # Genel hacim skoru 0-100 (yüksek = dolgun)
    age_indicator: str          # "genç", "orta", "olgun"


@dataclass
class WrinkleMapMetrics:
    """Kırışıklık bölge analizi."""
    forehead_score: float     # Alın çizgileri yoğunluğu 0-10
    glabellar_score: float    # Kaş arası dikey çizgiler 0-10
    crows_feet_score: float   # Göz kenarı kırışıkları 0-10
    nasolabial_score: float   # Nasolabial fold derinliği 0-10
    overall_score: float      # Genel kırışıklık skoru 0-100 (0=yok, 100=çok)
    dominant_zone: str        # En belirgin bölge
    botox_priority_zones: List[str]  # Botoks için öncelik sırası


@dataclass
class NasalMetrics:
    """Nazal oran analizi."""
    nasolabial_angle_deg: float    # Burun-dudak açısı (ideal kadın 95-115°, erkek 90-105°)
    nose_width_mm: float           # Alar taban genişliği
    nose_length_mm: float          # Radix'ten tip'e uzunluk
    nose_width_to_length: float    # Genişlik/uzunluk oranı (ideal ~0.7)
    nose_to_face_width: float      # Burun genişliği / yüz genişliği (ideal ~0.25)
    tip_projection: float          # Tip projeksiyonu (Goode metodu yaklaşımı)
    dorsum_deviation_mm: float     # Dorsum lateral sapma
    assessment: str                # Genel değerlendirme


@dataclass
class AnalysisResult:
    metrics:             AsymmetryMetrics
    annotated_image_b64: str
    landmarks_count:     int
    pose_warnings:       List[str] = field(default_factory=list)
    error:               Optional[str] = None
    key_landmarks_px:    dict = field(default_factory=dict)
    # Yeni estetik metrikler
    golden_ratio:        Optional[GoldenRatioMetrics]  = None
    canthal_tilt:        Optional[CanthalTiltMetrics]  = None
    face_shape:          Optional[FaceShapeResult]     = None
    volume_map:          Optional[VolumeMapMetrics]    = None
    wrinkle_map:         Optional[WrinkleMapMetrics]   = None
    nasal_metrics:       Optional[NasalMetrics]        = None


# ─── Renk paleti ──────────────────────────────────────────────────────────────
class C:
    TEAL      = (0,   210, 180)
    GOLD      = (30,  200, 255)
    CORAL     = (80,  100, 255)
    GREEN     = (80,  210, 80)
    LAVENDER  = (220, 160, 255)
    WHITE     = (255, 255, 255)
    BLACK     = (0,   0,   0)
    DARK      = (18,  18,  28)
    WARN_YEL  = (30,  210, 250)
    WARN_RED  = (60,  60,  230)

    @staticmethod
    def severity(mm_val: float):
        """Değere göre renk: yeşil→sarı→kırmızı."""
        v = abs(mm_val)
        if v < 1.0:  return C.GREEN
        if v < 2.5:  return C.GOLD
        return C.CORAL


class FaceAsymmetryAnalyzer:
    AVG_IPD_MM = 63.0

    # solvePnP için 3D yüz modeli noktaları (mm, standart)
    _MODEL_3D = np.array([
        [  0.0,    0.0,    0.0  ],   # Burun ucu     #4
        [  0.0,  -63.6,  -12.5 ],   # Çene           #152
        [-43.3,   32.7,  -26.0 ],   # Sol göz dış    #33
        [ 43.3,   32.7,  -26.0 ],   # Sağ göz dış    #263
        [-28.9,  -28.9,  -24.1 ],   # Sol ağız köşesi #61
        [ 28.9,  -28.9,  -24.1 ],   # Sağ ağız köşesi #291
    ], dtype=np.float64)

    _MODEL_IDX = [LM.NOSE_TIP, LM.CHIN_BOTTOM,
                  LM.LEFT_EYE_OUTER, LM.RIGHT_EYE_OUTER,
                  LM.MOUTH_LEFT, LM.MOUTH_RIGHT]

    def __init__(self):
        mp_face = mp.solutions.face_mesh
        self._mesh = mp_face.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        self._mp_face    = mp_face
        self._mp_drawing = mp.solutions.drawing_utils
        self._mp_styles  = mp.solutions.drawing_styles

    # ── Public ──────────────────────────────────────────────────────────────
    def analyze(self, image_bytes: bytes) -> AnalysisResult:
        img_bgr = self._decode(image_bytes)
        if img_bgr is None:
            return AnalysisResult(
                metrics=self._empty_metrics(0, 0),
                annotated_image_b64="",
                landmarks_count=0,
                error="Görüntü çözümlenemedi.",
            )

        h, w = img_bgr.shape[:2]
        result = self._mesh.process(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

        if not result.multi_face_landmarks:
            return AnalysisResult(
                metrics=self._empty_metrics(w, h),
                annotated_image_b64=self._encode(img_bgr),
                landmarks_count=0,
                error="Yüz tespit edilemedi.",
            )

        lm_list      = result.multi_face_landmarks[0].landmark
        pts          = self._to_px(lm_list, w, h)
        px_per_mm    = self._calibrate(pts)
        pose         = self._head_pose(pts, w, h)
        metrics      = self._compute(pts, px_per_mm, w, h, pose)
        golden_ratio = self._compute_golden_ratio(pts, px_per_mm, w, h)
        canthal_tilt = self._compute_canthal_tilt(pts)
        face_shape   = self._compute_face_shape(pts, px_per_mm)
        volume_map   = self._compute_volume_map(pts, img_bgr, px_per_mm)
        wrinkle_map  = self._compute_wrinkle_map(pts, img_bgr, px_per_mm)
        nasal        = self._compute_nasal(pts, px_per_mm)
        annotated    = self._draw(img_bgr.copy(), result, pts, metrics, pose, w, h)

        # Tedavi haritası için anahtar landmark koordinatlarını sakla
        # Masseter bölgesi (çene açısı) — sol:172, sağ:397
        def _avg2(a, b):
            pa, pb = pts.get(a), pts.get(b)
            if pa and pb:
                return ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
            return pa or pb

        key_lm = {
            "left_brow":      pts.get(LM.LEFT_BROW_INNER),
            "right_brow":     pts.get(LM.RIGHT_BROW_INNER),
            "left_eye_top":   pts.get(LM.LEFT_EYE_TOP),
            "right_eye_top":  pts.get(LM.RIGHT_EYE_TOP),
            "left_eye_bot":   pts.get(LM.LEFT_EYE_BOT),
            "right_eye_bot":  pts.get(LM.RIGHT_EYE_BOT),
            "mouth_left":     pts.get(LM.MOUTH_LEFT),
            "mouth_right":    pts.get(LM.MOUTH_RIGHT),
            "nose_tip":       pts.get(LM.NOSE_TIP),
            "forehead_top":   pts.get(LM.FOREHEAD_TOP),
            "chin_bottom":    pts.get(LM.CHIN_BOTTOM),
            "left_cheek":     pts.get(LM.LEFT_CHEEK),
            "right_cheek":    pts.get(LM.RIGHT_CHEEK),
            # Alın orta, göz kenar
            "forehead_mid":   pts.get(10),
            "left_eye_outer": pts.get(LM.LEFT_EYE_OUTER),
            "right_eye_outer":pts.get(LM.RIGHT_EYE_OUTER),
            # Masseter / çene açısı (sol:172, sağ:397)
            "jaw_left":       pts.get(172),
            "jaw_right":      pts.get(397),
            # Masseter merkezi: cheek + jaw ortalaması
            "masseter_left":  _avg2(LM.LEFT_CHEEK, 172),
            "masseter_right": _avg2(LM.RIGHT_CHEEK, 397),
            "masseter_center":_avg2(LM.LEFT_CHEEK, LM.RIGHT_CHEEK),
        }
        # Tuple → liste (JSON serializable)
        key_lm_serializable = {
            k: [round(v[0], 1), round(v[1], 1)] for k, v in key_lm.items() if v is not None
        }

        return AnalysisResult(
            metrics             = metrics,
            annotated_image_b64 = self._encode(annotated),
            landmarks_count     = len(lm_list),
            pose_warnings       = pose.warnings if pose else [],
            key_landmarks_px    = key_lm_serializable,
            golden_ratio        = golden_ratio,
            canthal_tilt        = canthal_tilt,
            face_shape          = face_shape,
            volume_map          = volume_map,
            wrinkle_map         = wrinkle_map,
            nasal_metrics       = nasal,
        )

    # ── Helpers ─────────────────────────────────────────────────────────────
    @staticmethod
    def _decode(data: bytes) -> Optional[np.ndarray]:
        arr = np.frombuffer(data, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    @staticmethod
    def _to_px(lms, w, h) -> dict:
        return {i: (lm.x * w, lm.y * h) for i, lm in enumerate(lms)}

    def _calibrate(self, pts: dict) -> float:
        try:
            ipd_px = math.dist(pts[LM.LEFT_PUPIL], pts[LM.RIGHT_PUPIL])
        except KeyError:
            ipd_px = math.dist(pts[LM.LEFT_EYE_INNER], pts[LM.RIGHT_EYE_INNER]) * 1.2
        return ipd_px / self.AVG_IPD_MM if ipd_px > 0 else 1.0

    # ── Head Pose (solvePnP) ─────────────────────────────────────────────────
    def _head_pose(self, pts: dict, w: int, h: int) -> Optional[HeadPose]:
        try:
            img_pts = np.array(
                [[pts[i][0], pts[i][1]] for i in self._MODEL_IDX],
                dtype=np.float64
            )
            focal   = w
            cam_mtx = np.array([
                [focal, 0,     w / 2],
                [0,     focal, h / 2],
                [0,     0,     1    ],
            ], dtype=np.float64)

            ok, rvec, _ = cv2.solvePnP(
                self._MODEL_3D, img_pts, cam_mtx,
                np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
            )
            if not ok:
                return None

            rmat, _ = cv2.Rodrigues(rvec)
            # Euler açıları — OpenCV konvansiyonu → [-90, 90] aralığına normalize et
            pitch_raw = math.degrees(math.atan2(rmat[2][1], rmat[2][2]))
            yaw   = math.degrees(math.atan2(-rmat[2][0],
                                  math.sqrt(rmat[2][1]**2 + rmat[2][2]**2)))
            roll  = math.degrees(math.atan2(rmat[1][0], rmat[0][0]))
            # Pitch normalizasyonu: 172° → 8° (yüz kameraya karşı duruyor)
            if pitch_raw > 90:
                pitch = 180 - pitch_raw
            elif pitch_raw < -90:
                pitch = -180 - pitch_raw
            else:
                pitch = pitch_raw

            return HeadPose(
                pitch_deg=round(pitch, 1),
                yaw_deg=round(yaw, 1),
                roll_deg=round(roll, 1),
            )
        except Exception:
            return None

    # ── Hesaplama ────────────────────────────────────────────────────────────
    def _compute(self, pts, px_mm, w, h, pose: Optional[HeadPose]) -> AsymmetryMetrics:
        def mm(v): return round(v / px_mm, 2)

        top   = pts[LM.FOREHEAD_TOP]
        bot   = pts[LM.CHIN_BOTTOM]
        angle = math.degrees(math.atan2(bot[0] - top[0], bot[1] - top[1]))

        lb_y = pts[LM.LEFT_BROW_INNER][1]
        rb_y = pts[LM.RIGHT_BROW_INNER][1]
        brow_px = abs(lb_y - rb_y)

        le_w = math.dist(pts[LM.LEFT_EYE_INNER],  pts[LM.LEFT_EYE_OUTER])
        re_w = math.dist(pts[LM.RIGHT_EYE_INNER], pts[LM.RIGHT_EYE_OUTER])
        eye_px = abs(le_w - re_w)

        ml_y = pts[LM.MOUTH_LEFT][1]
        mr_y = pts[LM.MOUTH_RIGHT][1]
        mouth_px = abs(ml_y - mr_y)

        ipd_px = math.dist(pts[LM.LEFT_EYE_INNER], pts[LM.RIGHT_EYE_INNER])

        brow_n  = min(brow_px  / (h * 0.08), 1.0)
        eye_n   = min(eye_px   / (w * 0.05), 1.0)
        mouth_n = min(mouth_px / (h * 0.05), 1.0)
        score   = round((1 - (brow_n * 0.4 + eye_n * 0.3 + mouth_n * 0.3)) * 100, 1)

        return AsymmetryMetrics(
            symmetry_score       = max(0.0, min(100.0, score)),
            brow_height_diff_px  = round(brow_px, 1),
            brow_height_diff_mm  = mm(brow_px),
            eye_width_diff_px    = round(eye_px, 1),
            eye_width_diff_mm    = mm(eye_px),
            mouth_corner_diff_px = round(mouth_px, 1),
            mouth_corner_diff_mm = mm(mouth_px),
            midline_angle_deg    = round(angle, 2),
            ipd_px               = round(ipd_px, 1),
            px_per_mm            = round(px_mm, 3),
            image_width          = w,
            image_height         = h,
            head_pose            = pose,
            details={
                "left_brow_y_px":    round(lb_y, 1),
                "right_brow_y_px":   round(rb_y, 1),
                "left_eye_width_px": round(le_w, 1),
                "right_eye_width_px":round(re_w, 1),
                "mouth_left_y_px":   round(ml_y, 1),
                "mouth_right_y_px":  round(mr_y, 1),
            },
        )

    # ── Altın Oran Analizi ───────────────────────────────────────────────────
    def _compute_golden_ratio(self, pts: dict, px_mm: float,
                               w: int, h: int) -> Optional[GoldenRatioMetrics]:
        try:
            def mm(v): return round(v / px_mm, 2)
            def pt(idx): return pts.get(idx)

            # Yüz yüksekliği: alın tepesi → çene
            top     = pt(LM.FOREHEAD_TOP)
            chin    = pt(LM.CHIN_BOTTOM)
            nose_b  = pt(2)    # Burun tabanı (LM 2 ≈ subnasal)
            brow_l  = pt(LM.LEFT_BROW_INNER)
            brow_r  = pt(LM.RIGHT_BROW_INNER)
            if not all([top, chin, nose_b, brow_l, brow_r]):
                return None

            face_h  = math.dist(top, chin)
            brow_y  = (brow_l[1] + brow_r[1]) / 2

            upper_h  = brow_y - top[1]
            middle_h = nose_b[1] - brow_y
            lower_h  = chin[1] - nose_b[1]

            if face_h < 1: return None
            upper_r  = round(upper_h  / face_h, 3)
            middle_r = round(middle_h / face_h, 3)
            lower_r  = round(lower_h  / face_h, 3)

            ideal = 1/3
            thirds_score = round(max(0, 100 - (
                abs(upper_r  - ideal) * 100 +
                abs(middle_r - ideal) * 100 +
                abs(lower_r  - ideal) * 100
            )), 1)

            # Göz genişliği oranı
            l_eye_w = math.dist(pt(LM.LEFT_EYE_INNER),  pt(LM.LEFT_EYE_OUTER))  if pt(LM.LEFT_EYE_INNER)  else 0
            r_eye_w = math.dist(pt(LM.RIGHT_EYE_INNER), pt(LM.RIGHT_EYE_OUTER)) if pt(LM.RIGHT_EYE_INNER) else 0
            face_w  = math.dist(pt(LM.LEFT_CHEEK), pt(LM.RIGHT_CHEEK)) if pt(LM.LEFT_CHEEK) else w * 0.7
            eye_to_face = round((l_eye_w + r_eye_w) / face_w, 3) if face_w > 0 else 0

            # Burun / intercanthal oranı
            nose_l = pt(294)  # Sol alar bazı yaklaşımı
            nose_r = pt(64)   # Sağ alar bazı
            icw_l  = pt(LM.LEFT_EYE_INNER)
            icw_r  = pt(LM.RIGHT_EYE_INNER)
            nose_w_ratio = 0.0
            if nose_l and nose_r and icw_l and icw_r:
                nose_w = math.dist(nose_l, nose_r)
                icw    = math.dist(icw_l, icw_r)
                nose_w_ratio = round(nose_w / icw, 3) if icw > 0 else 0

            # Dudak oranı
            upper_lip_top = pt(0)    # Filtrum alt noktası
            lip_center    = pt(17)   # Alt dudak alt noktası
            mouth_corner  = pt(LM.MOUTH_LEFT)
            ul_ratio = 0.0
            if upper_lip_top and lip_center and mouth_corner:
                upper_lip_h = abs(pt(0)[1] - pt(13)[1]) if pt(13) else 0
                lower_lip_h = abs(pt(14)[1] - pt(17)[1]) if all([pt(14), pt(17)]) else 0
                ul_ratio    = round(upper_lip_h / lower_lip_h, 3) if lower_lip_h > 0 else 0

            # Yüz genişlik/yükseklik oranı (ideal 0.6–0.75)
            fw_ratio = round(face_w / face_h, 3) if face_h > 0 else 0

            # Genel skor — idealden sapmalar ağırlıklı
            deviations = {
                "thirds":        abs(thirds_score - 100) / 100,
                "eye_face":      abs(eye_to_face - 0.50) * 3,
                "nose_icw":      abs(nose_w_ratio - 1.0) * 1.5 if nose_w_ratio else 0,
                "lip_ratio":     abs(ul_ratio - 0.6) * 2        if ul_ratio     else 0,
                "fw_ratio":      abs(fw_ratio - 0.68) * 2       if fw_ratio     else 0,
            }
            avg_dev = sum(deviations.values()) / max(len([v for v in deviations.values() if v > 0]), 1)
            golden_score = round(max(0, min(100, (1 - avg_dev) * 100)), 1)

            return GoldenRatioMetrics(
                facial_thirds_upper        = upper_r,
                facial_thirds_middle       = middle_r,
                facial_thirds_lower        = lower_r,
                thirds_score               = thirds_score,
                eye_width_to_face_ratio    = eye_to_face,
                nose_width_to_icw_ratio    = nose_w_ratio,
                upper_lower_lip_ratio      = ul_ratio,
                face_width_to_height_ratio = fw_ratio,
                golden_ratio_score         = golden_score,
                phi_deviations             = {k: round(v, 3) for k, v in deviations.items()},
            )
        except Exception:
            return None

    # ── Canthal Tilt ─────────────────────────────────────────────────────────
    def _compute_canthal_tilt(self, pts: dict) -> Optional[CanthalTiltMetrics]:
        try:
            l_inner = pts.get(LM.LEFT_EYE_INNER)
            l_outer = pts.get(LM.LEFT_EYE_OUTER)
            r_inner = pts.get(LM.RIGHT_EYE_INNER)
            r_outer = pts.get(LM.RIGHT_EYE_OUTER)
            if not all([l_inner, l_outer, r_inner, r_outer]):
                return None

            # Canthal tilt: dış köşenin iç köşeye göre dikey sapması
            # MediaPipe image koordinatlarında LEFT_EYE_OUTER (33) görüntünün sol
            # tarafında, LEFT_EYE_INNER (133) sağ tarafında olduğundan dx negatif
            # olabilir. Bu yüzden yatay mesafeyi mutlak alıp sadece dikey sapma
            # işaretine bakıyoruz: pozitif = dış köşe yukarıda (fox eye)
            l_dy = l_inner[1] - l_outer[1]          # + ise outer daha yukarı
            l_dx = abs(l_inner[0] - l_outer[0])
            l_tilt = math.degrees(math.atan2(l_dy, l_dx)) if l_dx > 1 else 0.0

            r_dy = r_inner[1] - r_outer[1]           # + ise outer daha yukarı
            r_dx = abs(r_inner[0] - r_outer[0])
            r_tilt = math.degrees(math.atan2(r_dy, r_dx)) if r_dx > 1 else 0.0
            avg    = round((l_tilt + r_tilt) / 2, 2)

            if avg > 3:   cls = "pozitif (fox eye / yukarı eğimli)"
            elif avg < -3: cls = "negatif (yorgun / aşağı eğimli)"
            else:          cls = "nötr (dengeli)"

            return CanthalTiltMetrics(
                left_tilt_deg       = round(l_tilt, 2),
                right_tilt_deg      = round(r_tilt, 2),
                avg_tilt_deg        = avg,
                tilt_symmetry_diff  = round(abs(l_tilt - r_tilt), 2),
                classification      = cls,
                left_inner_px       = l_inner,
                left_outer_px       = l_outer,
                right_inner_px      = r_inner,
                right_outer_px      = r_outer,
            )
        except Exception:
            return None

    # ── Yüz Şekli ────────────────────────────────────────────────────────────
    def _compute_face_shape(self, pts: dict, px_mm: float) -> Optional[FaceShapeResult]:
        try:
            def mm(v): return round(v / px_mm, 2)

            forehead_l = pts.get(103)  # Sol alın kenarı
            forehead_r = pts.get(332)  # Sağ alın kenarı
            cheek_l    = pts.get(LM.LEFT_CHEEK)
            cheek_r    = pts.get(LM.RIGHT_CHEEK)
            jaw_l      = pts.get(172)  # Sol çene köşesi
            jaw_r      = pts.get(397)  # Sağ çene köşesi
            top        = pts.get(LM.FOREHEAD_TOP)
            chin       = pts.get(LM.CHIN_BOTTOM)

            if not all([forehead_l, forehead_r, cheek_l, cheek_r, jaw_l, jaw_r, top, chin]):
                return None

            fw_px = math.dist(forehead_l, forehead_r)
            cw_px = math.dist(cheek_l, cheek_r)
            jw_px = math.dist(jaw_l, jaw_r)
            fl_px = math.dist(top, chin)

            fw_mm = mm(fw_px)
            cw_mm = mm(cw_px)
            jw_mm = mm(jw_px)
            fl_mm = mm(fl_px)

            # Oran hesapları
            fw_cw = fw_px / cw_px if cw_px > 0 else 1.0  # alın/elmacık
            jw_cw = jw_px / cw_px if cw_px > 0 else 1.0  # çene/elmacık
            fl_cw = fl_px / cw_px if cw_px > 0 else 1.4  # uzunluk/genişlik

            # Sınıflandırma kuralları
            if fl_cw > 1.5:
                if fw_cw < 0.85 and jw_cw < 0.75:
                    shape, shape_en, conf = "elmas",      "diamond",   0.80
                elif jw_cw < 0.80:
                    shape, shape_en, conf = "kalp",       "heart",     0.78
                else:
                    shape, shape_en, conf = "dikdörtgen", "rectangle", 0.75
            elif fl_cw > 1.2:
                if fw_cw > 0.92 and jw_cw > 0.85:
                    shape, shape_en, conf = "kare",   "square", 0.82
                elif jw_cw < 0.80:
                    shape, shape_en, conf = "oval",   "oval",   0.85
                else:
                    shape, shape_en, conf = "oval",   "oval",   0.80
            else:
                if jw_cw > 0.88:
                    shape, shape_en, conf = "kare",    "square", 0.72
                else:
                    shape, shape_en, conf = "yuvarlak","round",  0.80

            return FaceShapeResult(
                shape              = shape,
                shape_en           = shape_en,
                confidence         = conf,
                forehead_width_mm  = fw_mm,
                cheekbone_width_mm = cw_mm,
                jaw_width_mm       = jw_mm,
                face_length_mm     = fl_mm,
                ratios             = {
                    "forehead_to_cheek": round(fw_cw, 3),
                    "jaw_to_cheek":      round(jw_cw, 3),
                    "length_to_width":   round(fl_cw, 3),
                },
            )
        except Exception:
            return None

    # ── Hacim Haritası ───────────────────────────────────────────────────────
    def _compute_volume_map(self, pts: dict, img_bgr: np.ndarray,
                             px_mm: float) -> Optional[VolumeMapMetrics]:
        try:
            h, w = img_bgr.shape[:2]

            # Şakak çöküklüğü — şakak alanındaki doku yoğunluğu (parlaklık proxy)
            def region_brightness(cx, cy, rx, ry):
                x1, y1 = max(0, cx - rx), max(0, cy - ry)
                x2, y2 = min(w, cx + rx), min(h, cy + ry)
                if x2 <= x1 or y2 <= y1: return 128.0
                patch = img_bgr[y1:y2, x1:x2]
                return float(np.mean(cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)))

            # Şakak: alın kenarı ile kaş dış noktası arasında
            t_l = pts.get(103); t_r = pts.get(332)
            temporal_score = 5.0  # default orta
            if t_l and t_r:
                tl_b = region_brightness(int(t_l[0]), int(t_l[1]), 25, 20)
                tr_b = region_brightness(int(t_r[0]), int(t_r[1]), 25, 20)
                cheek_b = region_brightness(int((pts[LM.LEFT_CHEEK][0] + pts[LM.RIGHT_CHEEK][0])/2),
                                            int((pts[LM.LEFT_CHEEK][1] + pts[LM.RIGHT_CHEEK][1])/2),
                                            40, 30) if pts.get(LM.LEFT_CHEEK) else 128
                diff = cheek_b - (tl_b + tr_b) / 2
                temporal_score = round(min(10, max(0, diff / 15)), 1)

            # Elmacık dolgunluğu — yanak bölgesi parlaklığı görecelidir
            malar_score = 5.0
            if pts.get(LM.LEFT_CHEEK) and pts.get(LM.RIGHT_CHEEK):
                ml_b = region_brightness(int(pts[LM.LEFT_CHEEK][0]),  int(pts[LM.LEFT_CHEEK][1]),  35, 25)
                mr_b = region_brightness(int(pts[LM.RIGHT_CHEEK][0]), int(pts[LM.RIGHT_CHEEK][1]), 35, 25)
                avg_cheek = (ml_b + mr_b) / 2
                malar_score = round(min(10, max(0, (avg_cheek - 80) / 17)), 1)

            # Göz altı — alt göz kapağı bölgesinin koyuluğu
            tear_score = 5.0
            lb = pts.get(LM.LEFT_EYE_BOT); rb = pts.get(LM.RIGHT_EYE_BOT)
            if lb and rb:
                ll_b = region_brightness(int(lb[0]), int(lb[1] + 8), 20, 8)
                rl_b = region_brightness(int(rb[0]), int(rb[1] + 8), 20, 8)
                avg_eye_under = (ll_b + rl_b) / 2
                # Koyuysa derin çukur
                tear_score = round(min(10, max(0, (130 - avg_eye_under) / 10)), 1)

            # Nasolabial fold — burun yan - ağız köşesi aralığı
            nasolabial_score = 5.0
            ns = pts.get(LM.NOSE_TIP); ml = pts.get(LM.MOUTH_LEFT)
            if ns and ml:
                mid_x = int((ns[0] + ml[0]) / 2)
                mid_y = int((ns[1] + ml[1]) / 2)
                fold_b   = region_brightness(mid_x, mid_y, 12, 20)
                cheek_b2 = region_brightness(mid_x + 25, mid_y, 12, 20)
                nasolabial_score = round(min(10, max(0, (cheek_b2 - fold_b) / 8)), 1)

            overall = round(100 - (temporal_score * 3 + tear_score * 2.5 + nasolabial_score * 2) * 2, 1)
            overall = max(0, min(100, overall))

            if overall >= 65:    age_ind = "genç"
            elif overall >= 40:  age_ind = "orta"
            else:                age_ind = "olgun"

            return VolumeMapMetrics(
                temporal_hollowing  = temporal_score,
                malar_fullness      = malar_score,
                tear_trough_depth   = tear_score,
                nasolabial_depth    = nasolabial_score,
                overall_volume_score= overall,
                age_indicator       = age_ind,
            )
        except Exception:
            return None

    # ── Kırışıklık Haritası ──────────────────────────────────────────────────
    def _compute_wrinkle_map(self, pts: dict, img_bgr: np.ndarray,
                              px_mm: float) -> Optional[WrinkleMapMetrics]:
        try:
            h, w = img_bgr.shape[:2]
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            # Laplacian kenar yoğunluğu kırışıklık proxy'si olarak kullanılır
            lap  = cv2.Laplacian(gray, cv2.CV_64F)
            lap_abs = np.abs(lap)

            def zone_score(x1, y1, x2, y2, scale=1.0) -> float:
                x1, y1, x2, y2 = max(0,x1), max(0,y1), min(w,x2), min(h,y2)
                if x2 <= x1 or y2 <= y1: return 0.0
                region = lap_abs[y1:y2, x1:x2]
                val = float(np.percentile(region, 85))
                return round(min(10, val * scale / 25), 1)

            top    = pts.get(LM.FOREHEAD_TOP)
            brow_l = pts.get(LM.LEFT_BROW_INNER)
            brow_r = pts.get(LM.RIGHT_BROW_INNER)
            eye_lo = pts.get(LM.LEFT_EYE_OUTER)
            eye_ro = pts.get(LM.RIGHT_EYE_OUTER)
            ns     = pts.get(LM.NOSE_TIP)
            ml     = pts.get(LM.MOUTH_LEFT)

            forehead_s = glabellar_s = crows_s = nasolabial_s = 0.0

            # Alın bölgesi
            if top and brow_l and brow_r:
                brow_y = int((brow_l[1] + brow_r[1]) / 2)
                fx1 = int(brow_l[0] - 20); fx2 = int(brow_r[0] + 20)
                fy1 = int(top[1]);         fy2 = brow_y
                forehead_s = zone_score(fx1, fy1, fx2, fy2, 1.2)

            # Glabellar (kaş arası)
            if brow_l and brow_r:
                gx1 = int(brow_l[0] - 5); gx2 = int(brow_r[0] + 5)
                gy1 = int(min(brow_l[1], brow_r[1]) - 15)
                gy2 = int(max(brow_l[1], brow_r[1]) + 5)
                glabellar_s = zone_score(gx1, gy1, gx2, gy2, 1.5)

            # Crow's feet (göz kenarları)
            if eye_lo and eye_ro:
                cl_s = zone_score(int(eye_lo[0])-30, int(eye_lo[1])-15,
                                  int(eye_lo[0])+5,  int(eye_lo[1])+15, 1.3)
                cr_s = zone_score(int(eye_ro[0])-5,  int(eye_ro[1])-15,
                                  int(eye_ro[0])+30, int(eye_ro[1])+15, 1.3)
                crows_s = round((cl_s + cr_s) / 2, 1)

            # Nasolabial fold
            if ns and ml:
                nx = int((ns[0] + ml[0]) / 2)
                ny1 = int(ns[1]); ny2 = int(ml[1])
                nasolabial_s = zone_score(nx - 15, ny1, nx + 15, ny2, 1.2)

            overall = round((forehead_s * 2.5 + glabellar_s * 3 +
                             crows_s * 2.5 + nasolabial_s * 2) * 10 / 10, 1)
            overall = min(100, overall)

            zones = {"alın": forehead_s, "glabellar": glabellar_s,
                     "crow's feet": crows_s, "nasolabial": nasolabial_s}
            dominant = max(zones, key=lambda k: zones[k])
            priority = sorted(zones, key=lambda k: zones[k], reverse=True)

            return WrinkleMapMetrics(
                forehead_score       = forehead_s,
                glabellar_score      = glabellar_s,
                crows_feet_score     = crows_s,
                nasolabial_score     = nasolabial_s,
                overall_score        = overall,
                dominant_zone        = dominant,
                botox_priority_zones = [z for z in priority if zones[z] > 2.0],
            )
        except Exception:
            return None

    # ── Nazal Analiz ─────────────────────────────────────────────────────────
    def _compute_nasal(self, pts: dict, px_mm: float) -> Optional[NasalMetrics]:
        try:
            def mm(v): return round(v / px_mm, 2)

            nose_tip  = pts.get(LM.NOSE_TIP)
            nose_base = pts.get(2)          # Subnasal / kolumella baz
            alar_l    = pts.get(294)        # Sol alar baz (yaklaşım)
            alar_r    = pts.get(64)         # Sağ alar baz
            ul_top    = pts.get(0)          # Filtrum alt noktası (Cupid bow orta)
            upper_lip = pts.get(13)         # Üst dudak orta
            brow_l    = pts.get(LM.LEFT_BROW_INNER)
            brow_r    = pts.get(LM.RIGHT_BROW_INNER)
            cheek_l   = pts.get(LM.LEFT_CHEEK)
            cheek_r   = pts.get(LM.RIGHT_CHEEK)

            if not all([nose_tip, nose_base, alar_l, alar_r]):
                return None

            nose_w_px = math.dist(alar_l, alar_r)
            nose_l_px = math.dist(
                pts.get(168, nose_tip) if pts.get(168) else nose_tip,
                nose_base
            )
            nose_w_mm = mm(nose_w_px)
            nose_l_mm = mm(nose_l_px)

            # Nasolabial açı: frontal görüntüde 3D açı hesaplanamaz.
            # Burun tabanı ile üst dudak arasındaki YATAY mesafeden proxy bir açı
            # türetiyoruz: sağlıklı değer genellikle <10 px yatay sapma = 90-105°,
            # belirgin geri kaçık lip = büyük açı.
            # Gerçek ölçüm için profil fotoğrafı gereklidir.
            nasolabial_angle = 0.0
            nasal_profile_note = "frontal"
            if nose_base and upper_lip:
                # Yatay ofset: burun tabanı vs üst dudak merkezi
                horiz_offset = abs(nose_base[0] - upper_lip[0])
                vert_dist    = abs(upper_lip[1] - nose_base[1])
                if vert_dist > 1:
                    # Columella-lip angle proxy (frontal projeksiyon)
                    proxy_rad = math.atan2(horiz_offset, vert_dist)
                    # 0 ofset → 90°, büyük ofset → >90°
                    nasolabial_angle = round(90.0 + math.degrees(proxy_rad), 1)
                    nasal_profile_note = "frontal projeksiyon (yaklaşık)"

            # Oranlar
            face_w_px = math.dist(cheek_l, cheek_r) if cheek_l and cheek_r else 0
            nw_to_lh  = round(nose_w_px / nose_l_px,  3) if nose_l_px  > 0 else 0
            nw_to_fw  = round(nose_w_px / face_w_px,  3) if face_w_px  > 0 else 0

            # Tip projeksiyon (basit: burun ucu yatay çıkıntısı / burun tabanı mesafesi)
            tip_proj = round(abs(nose_tip[0] - (alar_l[0] + alar_r[0])/2) / nose_l_px, 3) if nose_l_px > 0 else 0

            # Dorsum lateral sapma — alın orta ile burun ucu X sapması
            dorsum_dev_mm = 0.0
            face_center_x = (pts.get(LM.FOREHEAD_TOP, nose_tip)[0] +
                             pts.get(LM.CHIN_BOTTOM,   nose_tip)[0]) / 2
            dorsum_dev_mm = mm(abs(nose_tip[0] - face_center_x))

            # Değerlendirme (frontal görüntü proxy)
            if nasolabial_angle == 0.0:
                assessment = "hesaplanamadı"
            elif 90 <= nasolabial_angle <= 115:
                assessment = f"ideal aralıkta ({nasal_profile_note})"
            elif nasolabial_angle < 90:
                assessment = f"akut açı — plunging tip olasılığı ({nasal_profile_note})"
            elif nasolabial_angle > 120:
                assessment = f"obtüz açı — upturned tip olasılığı ({nasal_profile_note})"
            else:
                assessment = f"sınırda ({nasal_profile_note})"

            return NasalMetrics(
                nasolabial_angle_deg  = nasolabial_angle,
                nose_width_mm         = nose_w_mm,
                nose_length_mm        = nose_l_mm,
                nose_width_to_length  = nw_to_lh,
                nose_to_face_width    = nw_to_fw,
                tip_projection        = tip_proj,
                dorsum_deviation_mm   = dorsum_dev_mm,
                assessment            = assessment,
            )
        except Exception:
            return None

    # ── Görselleştirme ───────────────────────────────────────────────────────
    def _draw(self, img: np.ndarray, mp_result, pts: dict,
              metrics: AsymmetryMetrics, pose: Optional[HeadPose],
              w: int, h: int) -> np.ndarray:

        # 1. Hafif karartma overlay (profesyonel görünüm)
        dark = img.copy()
        cv2.rectangle(dark, (0, 0), (w, h), (10, 10, 20), -1)
        cv2.addWeighted(dark, 0.18, img, 0.82, 0, img)

        # 2. Yüz mesh — ince, yarı saydam
        overlay = img.copy()
        for face_lm in mp_result.multi_face_landmarks:
            self._mp_drawing.draw_landmarks(
                image=overlay,
                landmark_list=face_lm,
                connections=self._mp_face.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=self._mp_drawing.DrawingSpec(
                    color=(120, 200, 180), thickness=1, circle_radius=0
                ),
            )
        cv2.addWeighted(overlay, 0.35, img, 0.65, 0, img)

        # 3. Yüz oval (yüz sınırı)
        oval_pts = [10,338,297,332,284,251,389,356,454,323,361,288,
                    397,365,379,378,400,377,152,148,176,149,150,136,
                    172,58,132,93,234,127,162,21,54,103,67,109]
        oval_px = np.array([[int(pts[i][0]), int(pts[i][1])]
                             for i in oval_pts if i in pts], dtype=np.int32)
        if len(oval_px) > 3:
            cv2.polylines(img, [oval_px], True, C.TEAL, 2, cv2.LINE_AA)

        # 4. Orta hat — degradeli çizgi
        top_pt = (int(pts[LM.FOREHEAD_TOP][0]), int(pts[LM.FOREHEAD_TOP][1]))
        bot_pt = (int(pts[LM.CHIN_BOTTOM][0]),  int(pts[LM.CHIN_BOTTOM][1]))
        self._draw_dashed_line(img, top_pt, bot_pt, C.TEAL, 2, gap=10)
        # Çarpı işareti orta nokta
        mx, my = (top_pt[0] + bot_pt[0]) // 2, (top_pt[1] + bot_pt[1]) // 2
        cv2.line(img, (mx - 10, my), (mx + 10, my), C.TEAL, 2, cv2.LINE_AA)
        cv2.line(img, (mx, my - 10), (mx, my + 10), C.TEAL, 2, cv2.LINE_AA)

        # 5. Kaş hattı
        lbx, lby = int(pts[LM.LEFT_BROW_INNER][0]),  int(pts[LM.LEFT_BROW_INNER][1])
        rbx, rby = int(pts[LM.RIGHT_BROW_INNER][0]), int(pts[LM.RIGHT_BROW_INNER][1])
        brow_col = C.severity(metrics.brow_height_diff_mm)
        cv2.line(img, (lbx, lby), (rbx, rby), brow_col, 2, cv2.LINE_AA)
        self._filled_dot(img, (lbx, lby), brow_col, 7)
        self._filled_dot(img, (rbx, rby), brow_col, 7)
        # Dikey fark oku
        if abs(lby - rby) > 3:
            mid_brow_x = (lbx + rbx) // 2
            cv2.arrowedLine(img, (mid_brow_x, min(lby, rby) - 5),
                            (mid_brow_x, max(lby, rby) + 5),
                            brow_col, 2, cv2.LINE_AA, tipLength=0.3)

        # 6. Göz açıklık çizgileri
        for top_i, bot_i, side in [(LM.LEFT_EYE_TOP,  LM.LEFT_EYE_BOT,  "L"),
                                    (LM.RIGHT_EYE_TOP, LM.RIGHT_EYE_BOT, "R")]:
            if top_i in pts and bot_i in pts:
                et = (int(pts[top_i][0]), int(pts[top_i][1]))
                eb = (int(pts[bot_i][0]), int(pts[bot_i][1]))
                eye_col = C.severity(metrics.eye_width_diff_mm)
                cv2.line(img, et, eb, eye_col, 2, cv2.LINE_AA)
                self._filled_dot(img, et, eye_col, 4)
                self._filled_dot(img, eb, eye_col, 4)

        # 7. Dudak köşeleri
        mlx, mly = int(pts[LM.MOUTH_LEFT][0]),  int(pts[LM.MOUTH_LEFT][1])
        mrx, mry = int(pts[LM.MOUTH_RIGHT][0]), int(pts[LM.MOUTH_RIGHT][1])
        mouth_col = C.severity(metrics.mouth_corner_diff_mm)
        cv2.line(img, (mlx, mly), (mrx, mry), mouth_col, 2, cv2.LINE_AA)
        self._filled_dot(img, (mlx, mly), mouth_col, 7)
        self._filled_dot(img, (mrx, mry), mouth_col, 7)

        # 8. Head Pose göstergesi (sağ üst — kompas)
        if pose:
            self._draw_pose_compass(img, pose, w, h)

        # 9. Bilgi paneli (sol üst — yarı saydam)
        img = self._draw_info_panel(img, metrics, pose, w, h)

        # 10. Pose uyarısı (üst orta — kırmızı banner)
        if pose and pose.warnings:
            self._draw_warning_banner(img, pose.warnings, w)

        return img

    # ── Alt çizim yardımcıları ───────────────────────────────────────────────
    @staticmethod
    def _filled_dot(img, center, color, r=6):
        cv2.circle(img, center, r + 2, (0, 0, 0), -1, cv2.LINE_AA)   # kenar
        cv2.circle(img, center, r, color, -1, cv2.LINE_AA)

    @staticmethod
    def _draw_dashed_line(img, p1, p2, color, thickness=1, gap=8):
        dist  = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        steps = int(dist / gap)
        for i in range(steps):
            t0 = i / steps
            t1 = min((i + 0.5) / steps, 1.0)
            x0 = int(p1[0] + (p2[0] - p1[0]) * t0)
            y0 = int(p1[1] + (p2[1] - p1[1]) * t0)
            x1 = int(p1[0] + (p2[0] - p1[0]) * t1)
            y1 = int(p1[1] + (p2[1] - p1[1]) * t1)
            cv2.line(img, (x0, y0), (x1, y1), color, thickness, cv2.LINE_AA)

    @staticmethod
    def _draw_pose_compass(img, pose: HeadPose, w, h):
        """Sağ üst köşede küçük kompas göstergesi."""
        cx, cy, r = w - 55, 55, 40
        overlay = img.copy()
        cv2.circle(overlay, (cx, cy), r, (20, 20, 30), -1)
        cv2.addWeighted(overlay, 0.7, img, 0.3, 0, img)
        cv2.circle(img, (cx, cy), r, (80, 80, 100), 1, cv2.LINE_AA)

        # Yaw: yatay çizgi
        yaw_x = int(cx + (pose.yaw_deg / 40) * r)
        cv2.arrowedLine(img, (cx, cy), (yaw_x, cy),
                        C.WARN_YEL if abs(pose.yaw_deg) > 12 else C.TEAL,
                        2, cv2.LINE_AA, tipLength=0.4)
        # Pitch: dikey çizgi
        pit_y = int(cy + (pose.pitch_deg / 40) * r)
        cv2.arrowedLine(img, (cx, cy), (cx, pit_y),
                        C.WARN_YEL if abs(pose.pitch_deg) > 10 else C.TEAL,
                        2, cv2.LINE_AA, tipLength=0.4)
        # Roll label
        roll_col = C.WARN_RED if abs(pose.roll_deg) > 10 else (120, 120, 140)
        cv2.putText(img, f"{pose.roll_deg:+.0f}d",
                    (cx - 18, cy + r + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, roll_col, 1, cv2.LINE_AA)
        cv2.putText(img, "POSE",
                    (cx - 14, cy - r - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (120, 120, 140), 1, cv2.LINE_AA)

    @staticmethod
    def _draw_info_panel(img, metrics: AsymmetryMetrics, pose, w, h):
        """Sol üst panel — skor + ölçümler."""
        panel_w, panel_h = 220, 140
        px, py = 12, 12
        overlay = img.copy()
        cv2.rectangle(overlay, (px, py), (px + panel_w, py + panel_h), C.DARK, -1)
        cv2.addWeighted(overlay, 0.78, img, 0.22, 0, img)
        cv2.rectangle(img, (px, py), (px + panel_w, py + panel_h), C.TEAL, 1, cv2.LINE_AA)

        # Skor çubuğu
        score = metrics.symmetry_score
        s_col = C.GREEN if score >= 85 else (C.GOLD if score >= 65 else C.CORAL)
        cv2.putText(img, f"{score:.1f}", (px + 8, py + 34),
                    cv2.FONT_HERSHEY_DUPLEX, 0.8, s_col, 1, cv2.LINE_AA)
        cv2.putText(img, "/100 Simetri", (px + 56, py + 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, (180, 180, 180), 1, cv2.LINE_AA)
        # Progress bar
        bar_x, bar_y = px + 8, py + 48
        bar_w = panel_w - 16
        cv2.rectangle(img, (bar_x, bar_y), (bar_x + bar_w, bar_y + 6), (50, 50, 60), -1)
        fill = int(bar_w * score / 100)
        cv2.rectangle(img, (bar_x, bar_y), (bar_x + fill, bar_y + 6), s_col, -1)

        # Metrik satırları (PIL — Türkçe karakter desteği)
        rows = [
            (f"Kaş:   {metrics.brow_height_diff_mm:+.2f} mm",  C.severity(metrics.brow_height_diff_mm)),
            (f"Göz:   {metrics.eye_width_diff_mm:+.2f} mm",    C.severity(metrics.eye_width_diff_mm)),
            (f"Dudak: {metrics.mouth_corner_diff_mm:+.2f} mm", C.severity(metrics.mouth_corner_diff_mm)),
            (f"Eksen: {metrics.midline_angle_deg:+.1f}°",      C.TEAL),
        ]
        for i, (txt, col) in enumerate(rows):
            img = _put_text_unicode(img, txt, (px + 10, py + 58 + i * 17), 12, col)
        return img

    @staticmethod
    def _draw_warning_banner(img, warnings: list, w: int):
        """Üst orta kırmızı uyarı bandı."""
        msg = "  ⚠  " + "  |  ".join(warnings)
        bh  = 32
        overlay = img.copy()
        bx = w // 6
        cv2.rectangle(overlay, (bx, 0), (w - bx, bh), (30, 30, 180), -1)
        cv2.addWeighted(overlay, 0.82, img, 0.18, 0, img)
        cv2.putText(img, msg, (bx + 10, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 220, 255), 1, cv2.LINE_AA)

    @staticmethod
    def _encode(img: np.ndarray) -> str:
        _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        return base64.b64encode(buf).decode()

    @staticmethod
    def _empty_metrics(w, h) -> AsymmetryMetrics:
        return AsymmetryMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, w, h)

    # ── Tedavi Haritası Görselleştirmesi ─────────────────────────────────────
    @staticmethod
    def draw_treatment_map(
        annotated_image_b64: str,
        key_landmarks_px: dict,
        recommendations: list,
    ) -> tuple:
        """
        Mevcut annotated görüntü üzerine AI tedavi önerilerini işaretler.
        Sadece numaralı pin çemberleri çizer — etiket metni HTML tooltip'e taşındı.
        Returns: (image_b64: str, treatment_pins: list)
          treatment_pins: [{idx, x_pct, y_pct, treatment, target_muscle,
                            region, estimated_units, notes, priority, color_hex}]
        """
        img_data = base64.b64decode(annotated_image_b64)
        arr      = np.frombuffer(img_data, dtype=np.uint8)
        img      = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return annotated_image_b64, []

        h, w = img.shape[:2]
        lm = key_landmarks_px

        # Hafif koyu overlay
        overlay = img.copy()
        cv2.rectangle(overlay, (0, 0), (w, h), (5, 5, 15), -1)
        cv2.addWeighted(overlay, 0.22, img, 0.78, 0, img)

        def avg_pt(*keys):
            pts_list = [lm[k] for k in keys if k in lm]
            if not pts_list: return None
            return (int(sum(p[0] for p in pts_list) / len(pts_list)),
                    int(sum(p[1] for p in pts_list) / len(pts_list)))

        # ── Kas adı → anatomik konum (ÖNCE bu kontrol edilir) ────────────
        MUSCLE_MAP = {
            # Çene / masseter
            "masseter":               lambda: avg_pt("masseter_left", "masseter_right"),
            # Alın
            "frontalis":              lambda: avg_pt("forehead_mid"),
            # Kaş bölgesi
            "corrugator":             lambda: avg_pt("left_brow", "right_brow"),
            "procerus":               lambda: avg_pt("left_brow", "right_brow"),
            # Göz
            "orbicularis oculi":      lambda: avg_pt("left_eye_top", "right_eye_top"),
            # Dudak / ağız
            "orbicularis oris":       lambda: avg_pt("mouth_left", "mouth_right"),
            "depressor anguli oris":  lambda: avg_pt("mouth_left", "mouth_right"),
            "depressor anguli":       lambda: avg_pt("mouth_left", "mouth_right"),
            "risorius":               lambda: avg_pt("mouth_left", "mouth_right"),
            # Çene alt
            "mentalis":               lambda: avg_pt("chin_bottom"),
            "platysma":               lambda: avg_pt("chin_bottom"),
            "digastric":              lambda: avg_pt("chin_bottom"),
            # Yanak
            "zygomaticus":            lambda: avg_pt("left_cheek", "right_cheek"),
            "buccinator":             lambda: avg_pt("left_cheek", "right_cheek"),
            # Cilt bazlı tedaviler (target_muscle = "cilt — xxx")
            "cilt — alın":            lambda: avg_pt("forehead_mid"),
            "cilt — yanak":           lambda: avg_pt("left_cheek", "right_cheek"),
            "cilt — göz":             lambda: avg_pt("left_eye_bot", "right_eye_bot"),
            "cilt — göz altı":        lambda: avg_pt("left_eye_bot", "right_eye_bot"),
            "cilt — dudak":           lambda: avg_pt("mouth_left", "mouth_right"),
            "cilt — burun":           lambda: avg_pt("nose_tip"),
            "cilt — çene":            lambda: avg_pt("chin_bottom"),
            "cilt — boyun":           lambda: avg_pt("chin_bottom"),
            "cilt":                   lambda: avg_pt("left_cheek", "right_cheek"),  # genel fallback
        }

        # ── Bölge adı → konum (fallback) ─────────────────────────────────
        REGION_MAP = {
            "kaş":        lambda: avg_pt("left_brow", "right_brow"),
            "göz":        lambda: avg_pt("left_eye_top", "right_eye_top"),
            "göz çevresi":lambda: avg_pt("left_eye_top", "right_eye_top"),
            "göz altı":   lambda: avg_pt("left_eye_bot", "right_eye_bot"),
            "dudak":      lambda: avg_pt("mouth_left", "mouth_right"),
            "ağız":       lambda: avg_pt("mouth_left", "mouth_right"),
            "orta hat":   lambda: avg_pt("nose_tip"),  # burun çizgisi orta hattı temsil eder
            "alın":       lambda: avg_pt("forehead_mid"),
            "yanak":      lambda: avg_pt("left_cheek", "right_cheek"),
            "sol yanak":  lambda: avg_pt("masseter_left"),
            "sağ yanak":  lambda: avg_pt("masseter_right"),
            "çene":       lambda: avg_pt("chin_bottom"),
            "burun":      lambda: avg_pt("nose_tip"),
            "cilt":       lambda: avg_pt("left_cheek", "right_cheek"),
            "lazer":      lambda: avg_pt("left_cheek", "right_cheek"),
            "prp":        lambda: avg_pt("forehead_mid"),
        }

        TREATMENT_COLORS = {
            "botoks":    (0,   210, 255),   # sarı-mavi
            "botulinum": (0,   210, 255),
            "filler":    (200, 100, 255),   # mor
            "dolgu":     (200, 100, 255),
            "hyalüronik":(200, 100, 255),
            "asma":      (80,  230, 130),   # yeşil
            "lifting":   (80,  230, 130),
            "iplik":     (80,  230, 130),
            "lazer":     (60,  160, 255),   # turuncu
            "laser":     (60,  160, 255),
            "prp":       (120, 255, 180),   # yeşil-mavi
            "mezoterapi":(80,  200, 255),   # açık mavi
            "peeling":   (255, 140, 80),    # şeftali
            "kimyasal":  (255, 140, 80),
            "karbon":    (180, 180, 220),   # gri-mor
            "ultrason":  (255, 200, 60),    # altın
            "default":   (200, 200, 255),
        }

        def get_color(treatment_name: str):
            t = treatment_name.lower()
            for key, col in TREATMENT_COLORS.items():
                if key in t:
                    return col
            return TREATMENT_COLORS["default"]

        def bgr_to_hex(bgr):
            b, g, r = bgr
            return f"#{r:02x}{g:02x}{b:02x}"

        # Kas adı → (rx_factor, ry_factor) — görüntü boyutuna oransal elips boyutu
        MUSCLE_ELLIPSE = {
            "masseter":              (0.07, 0.09),
            "frontalis":             (0.20, 0.055),
            "corrugator":            (0.09, 0.035),
            "procerus":              (0.04, 0.04),
            "orbicularis oculi":     (0.07, 0.04),
            "orbicularis oris":      (0.055, 0.04),
            "depressor anguli oris": (0.04, 0.035),
            "depressor anguli":      (0.04, 0.035),
            "mentalis":              (0.04, 0.04),
            "platysma":              (0.07, 0.05),
            "zygomaticus":           (0.07, 0.055),
            "buccinator":            (0.06, 0.06),
            "risorius":              (0.04, 0.03),
            "default":               (0.055, 0.055),
        }

        def get_ellipse_size(muscle_key: str):
            mk = muscle_key.lower()
            for key, sz in MUSCLE_ELLIPSE.items():
                if key in mk:
                    return sz
            return MUSCLE_ELLIPSE["default"]

        drawn_positions = []
        treatment_pins  = []

        for i, rec in enumerate(recommendations):
            region_raw    = rec.get("region", "").lower().strip()
            target_muscle = rec.get("target_muscle", "").lower().strip()
            treatment     = rec.get("treatment", "Tedavi")
            units         = rec.get("estimated_units") or ""
            priority      = rec.get("priority", "medium")
            notes         = rec.get("notes", "")

            # Konum: önce kas adı, sonra bölge
            center = None
            if target_muscle:
                for key, fn in MUSCLE_MAP.items():
                    if key in target_muscle:
                        center = fn()
                        break
            if center is None:
                for key, fn in REGION_MAP.items():
                    if key in region_raw:
                        center = fn()
                        break
            if center is None:
                fallback_y = [int(h * 0.25), int(h * 0.42), int(h * 0.58), int(h * 0.72)]
                center = (w // 2, fallback_y[i % len(fallback_y)])

            # Çakışma önleme — 8 yönde dene, en az çakışan konumu seç
            _OFFSETS = [
                (0,    0),
                (60,   0), (-60,  0), (0,  -58), (0,   58),
                (44, -44), (-44, -44), (44,  44), (-44, 44),
                (85,   0), (-85,  0), (0,  -85), (0,   85),
            ]
            _orig = center
            _chosen = None
            for ox, oy in _OFFSETS:
                cand = (
                    max(20, min(w - 20, _orig[0] + ox)),
                    max(20, min(h - 20, _orig[1] + oy)),
                )
                if all(math.hypot(cand[0] - dp[0], cand[1] - dp[1]) >= 52
                       for dp in drawn_positions):
                    _chosen = cand
                    break
            if _chosen is None:
                # Hiçbir pozisyon yeterince uzak değil → mevcut drawn_positions'a en uzak olanı seç
                _best, _best_d = _orig, -1.0
                for ox, oy in _OFFSETS[1:]:
                    cand = (
                        max(20, min(w - 20, _orig[0] + ox)),
                        max(20, min(h - 20, _orig[1] + oy)),
                    )
                    md = min(math.hypot(cand[0] - dp[0], cand[1] - dp[1])
                             for dp in drawn_positions)
                    if md > _best_d:
                        _best_d, _best = md, cand
                _chosen = _best
            center = _chosen
            drawn_positions.append(center)

            color  = get_color(treatment)
            pin_r  = 11 if priority == "high" else 9
            cx, cy = center

            # ── Kas bölgesi elipsi (zone highlight) ──────────────────────
            muscle_key  = target_muscle or region_raw
            rx_f, ry_f  = get_ellipse_size(muscle_key)
            rx = max(int(w * rx_f), pin_r + 10)
            ry = max(int(h * ry_f), pin_r + 10)

            # 1. En dış: çok hafif dolgu
            zone_overlay = img.copy()
            cv2.ellipse(zone_overlay, (cx, cy), (rx + 8, ry + 8), 0, 0, 360, color, -1, cv2.LINE_AA)
            cv2.addWeighted(zone_overlay, 0.08, img, 0.92, 0, img)

            # 2. Orta: biraz daha belirgin dolgu
            zone_overlay2 = img.copy()
            cv2.ellipse(zone_overlay2, (cx, cy), (rx, ry), 0, 0, 360, color, -1, cv2.LINE_AA)
            cv2.addWeighted(zone_overlay2, 0.15, img, 0.85, 0, img)

            # 3. Kenarlık: kesik çizgi efekti (birden fazla arc)
            for angle_start in range(0, 360, 24):
                cv2.ellipse(img, (cx, cy), (rx, ry), 0,
                            angle_start, angle_start + 16,
                            color, 1, cv2.LINE_AA)

            # ── Pin (zone merkezi) ────────────────────────────────────────
            for ring_r, alpha in [(pin_r + 10, 0.12), (pin_r + 5, 0.22), (pin_r, 1.0)]:
                ro = img.copy()
                cv2.circle(ro, (cx, cy), ring_r, color, -1, cv2.LINE_AA)
                cv2.addWeighted(ro, alpha, img, 1.0 - alpha, 0, img)

            cv2.circle(img, (cx, cy), pin_r - 5, (10, 10, 20), -1, cv2.LINE_AA)
            cv2.circle(img, (cx, cy), 3, color, -1, cv2.LINE_AA)
            cv2.circle(img, (cx, cy), pin_r, color, 2, cv2.LINE_AA)

            # Sadece numara
            img = _put_text_unicode(img, str(i + 1), (cx - 4, cy - 6), 9, (255, 255, 255), bold=True)

            treatment_pins.append({
                "idx":             i + 1,
                "x_pct":          round(cx / w * 100, 2),
                "y_pct":          round(cy / h * 100, 2),
                "treatment":      rec.get("treatment", ""),
                "target_muscle":  rec.get("target_muscle", ""),
                "region":         rec.get("region", ""),
                "estimated_units": units,
                "notes":          notes,
                "priority":       priority,
                "color_hex":      bgr_to_hex(color),
            })

        # ── Alt legend ────────────────────────────────────────────────────
        if recommendations:
            legend_y = h - 22
            legend_items = [
                ((0, 210, 255),   "Botoks"),
                ((200, 100, 255), "Filler/Dolgu"),
                ((80, 230, 130),  "Lifting"),
            ]
            lx_start = 10
            for col, lbl in legend_items:
                cv2.circle(img, (lx_start + 6, legend_y + 6), 5, col, -1, cv2.LINE_AA)
                img = _put_text_unicode(img, lbl, (lx_start + 16, legend_y - 2), 12, (180, 180, 180))
                lx_start += 95
            img = _put_text_unicode(img, "AI Tedavi Haritasi",
                                    (w - 175, legend_y - 2), 12, (120, 120, 160))

        _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        return base64.b64encode(buf).decode(), treatment_pins
