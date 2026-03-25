"""
AIInterpreter
=============
OpenCV asimetri verilerini OpenAI GPT aracılığıyla
doktor / hasta odaklı profesyonel klinik rapora dönüştürür.

Çıktı JSON şeması:
  clinical_summary         : str
  regional_findings        : [{region, finding, severity}]
  recommendations          : [{treatment, region, priority, notes}]
  contraindications        : str | null
  patient_communication    : str
  follow_up_interval_weeks : int
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.services.opencv_engine import AsymmetryMetrics

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────── #
#  Sistem promptu                                                              #
# ─────────────────────────────────────────────────────────────────────────── #

_SYSTEM_PROMPT = """\
Sen, medikal estetik ve yüz anatomisi alanında 15 yıllık deneyime sahip, \
Türkiye'de lisanslı bir plastik cerrah ve dermatoloji uzmanısın.

Görevin: OpenCV tabanlı yüz asimetri analiz sisteminden gelen sayısal ölçümleri, \
doktorun hastasına sunabileceği profesyonel ve etik bir klinik rapora dönüştürmek.

Kurallar:
- Her zaman Türkçe yaz.
- Tıbbi terminolojiyi açıklayıcı biçimde kullan; jargon kullanmaktan kaçın.
- "Kesinlikle düzelir", "garanti" gibi ifadeler kullanma.
- 1 mm'den küçük sapmalar için "klinik olarak önemsiz" ifadesini kullan.
- Önerilen tedaviler yalnızca yetkilendirilmiş medikal estetik prosedürleri kapsamalı \
  (botulinum toksin, hyalüronik asit dolgu, PDO iplik, vb.).
- KVKK ve tıp etiği ilkelerine uy.
- Yalnızca aşağıdaki JSON şemasına uygun çıktı ver; ek açıklama ekleme.

JSON Şeması:
{
  "clinical_summary": "string — genel klinik değerlendirme (2-4 cümle)",
  "regional_findings": [
    {
      "region": "eyebrow|eye|lip|nose|midline",
      "finding": "string — bölgesel bulgu açıklaması",
      "severity": "none|mild|moderate|severe"
    }
  ],
  "recommendations": [
    {
      "treatment": "string — önerilen tedavi adı",
      "region": "string",
      "priority": "high|medium|low",
      "estimated_units": "string veya null (örn: '2-4 Ü')",
      "notes": "string"
    }
  ],
  "contraindications": "string veya null",
  "patient_communication": "string — hasta ile doğrudan paylaşılabilecek, 2-3 cümlelik özet",
  "follow_up_interval_weeks": 4
}
"""


# ─────────────────────────────────────────────────────────────────────────── #
#  Interpreter sınıfı                                                         #
# ─────────────────────────────────────────────────────────────────────────── #

class AIInterpreter:
    """
    Kullanım::

        interpreter = AIInterpreter()
        report = await interpreter.generate_clinical_report(metrics, age=42)
    """

    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def generate_clinical_report(
        self,
        metrics: AsymmetryMetrics,
        patient_age: Optional[int] = None,
        patient_notes: Optional[str] = None,
        doctor_notes: Optional[str] = None,
    ) -> dict:
        """
        Returns:
            {
                "clinical_summary"          : str,
                "regional_findings"         : list[dict],
                "recommendations"           : list[dict],
                "contraindications"         : str | None,
                "patient_communication"     : str,
                "follow_up_interval_weeks"  : int,
                "ai_model"                  : str,
                "prompt_tokens"             : int,
                "completion_tokens"         : int,
            }
        """
        user_message = self._build_user_message(
            metrics, patient_age, patient_notes, doctor_notes
        )

        try:
            response = await self._client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message},
                ],
                temperature=0.35,
                max_tokens=1400,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            logger.exception("OpenAI API çağrısı başarısız: %s", exc)
            raise

        raw = response.choices[0].message.content or "{}"

        try:
            data: dict = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("OpenAI yanıtı JSON parse edilemedi:\n%s", raw)
            data = {
                "clinical_summary": raw,
                "regional_findings": [],
                "recommendations": [],
                "contraindications": None,
                "patient_communication": raw,
                "follow_up_interval_weeks": 4,
            }

        return {
            **data,
            "ai_model":         response.model,
            "prompt_tokens":    response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        }

    # ────────────────────────────────────────────────────────────────────── #
    #  Kullanıcı mesajı oluşturma                                             #
    # ────────────────────────────────────────────────────────────────────── #

    @staticmethod
    def _build_user_message(
        m: AsymmetryMetrics,
        age: Optional[int],
        patient_notes: Optional[str],
        doctor_notes: Optional[str],
    ) -> str:
        def severity(val_mm: float) -> str:
            abs_v = abs(val_mm)
            if abs_v < 0.5:  return "Klinik olarak önemsiz"
            if abs_v < 1.5:  return "Hafif"
            if abs_v < 3.0:  return "Orta"
            return "Belirgin"

        def side(val_mm: float, pos_label: str, neg_label: str) -> str:
            if abs(val_mm) < 0.3:
                return "simetrik"
            return pos_label if val_mm > 0 else neg_label

        lines = [
            "Aşağıdaki yüz asimetri analiz sonuçları için klinik rapor oluştur:",
            "",
            f"**Genel Simetri Skoru:** {m.symmetry_score}/100",
            f"**Kalibrasyon (px/mm):** {m.px_per_mm:.2f}",
            "",
            "**Bölgesel Ölçümler:**",
            (
                f"- **Kaş:** {m.eyebrow_delta_mm:+.2f} mm "
                f"({side(m.eyebrow_delta_mm, 'sol kaş daha yüksek', 'sağ kaş daha yüksek')}) "
                f"— {severity(m.eyebrow_delta_mm)}"
            ),
            (
                f"- **Göz açıklığı:** {m.eye_delta_mm:+.2f} mm "
                f"({side(m.eye_delta_mm, 'sol göz daha açık', 'sağ göz daha açık')}) "
                f"— {severity(m.eye_delta_mm)}"
            ),
            (
                f"- **Dudak köşesi:** {m.lip_delta_mm:+.2f} mm "
                f"({side(m.lip_delta_mm, 'sol köşe yukarıda', 'sağ köşe yukarıda')}) "
                f"— {severity(m.lip_delta_mm)}"
            ),
            (
                f"- **Burun sapması:** {m.nose_deviation_mm:+.2f} mm "
                f"({side(m.nose_deviation_mm, 'sağa', 'sola')}) "
                f"— {severity(m.nose_deviation_mm)}"
            ),
            (
                f"- **Orta hat sapması:** {m.midline_deviation_mm:+.2f} mm "
                f"— {severity(m.midline_deviation_mm)}"
            ),
        ]

        if age is not None:
            lines += ["", f"**Hasta Yaşı:** {age}"]

        if patient_notes:
            lines += ["", f"**Hasta Şikayeti:** {patient_notes}"]

        if doctor_notes:
            lines += ["", f"**Doktor Notu:** {doctor_notes}"]

        return "\n".join(lines)
