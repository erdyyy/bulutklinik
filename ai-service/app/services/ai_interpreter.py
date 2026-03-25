"""
AI Yorum Modülü — Çoklu LLM Desteği
=====================================
LLM_PROVIDER env değişkeni ile provider seçilir:

  LLM_PROVIDER=claude   →  Anthropic Claude  (ANTHROPIC_API_KEY)  [default]
  LLM_PROVIDER=openai   →  OpenAI GPT-4o     (OPENAI_API_KEY)
  LLM_PROVIDER=gemini   →  Google Gemini     (GOOGLE_API_KEY)

API anahtarı yoksa None döner → frontend fallback mesajı gösterir.
"""

import os
from typing import Optional

# ─── Provider seçimi ──────────────────────────────────────────────────────────

LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "claude").lower()

# ─── Sistem Prompt (tüm provider'larda ortak) ─────────────────────────────────

SYSTEM_PROMPT = """Sen medikal estetik alanında uzman bir plastik cerrah asistanısın.
Sana verilen yüz asimetri analiz verilerini yorumlayacak ve doktorun hastaya sunabileceği
profesyonel bir klinik rapor oluşturacaksın.

ÇIKTI FORMATI — Yanıtını YALNIZCA geçerli bir JSON nesnesi olarak ver.
Markdown kod bloğu (```) kullanma. Düz JSON yaz, başka hiçbir metin ekleme.

Beklenen JSON yapısı:
{
  "clinical_summary": "2-3 cümle genel değerlendirme",
  "regional_findings": [
    {
      "region": "bölge adı (kaş/göz/dudak/orta hat)",
      "finding": "klinik bulgu açıklaması",
      "severity": "none|mild|moderate|severe"
    }
  ],
  "recommendations": [
    {
      "treatment": "prosedür adı (ör: Botulinum Toksin)",
      "region": "hedef bölge (ör: göz çevresi)",
      "target_muscle": "hedeflenen kas adı (ör: orbicularis oculi, corrugator supercilii, frontalis, depressor anguli oris, mentalis, masseter, procerus)",
      "priority": "high|medium|low",
      "estimated_units": "2-4 Ü botoks (varsa, yoksa null)",
      "notes": "kısa klinik not — kas adı, etki mekanizması, beklenen sonuç"
    }
  ],
  "contraindications": "varsa kontraendikasyonlar, yoksa null",
  "patient_communication": "hastaya teknik olmayan dilde açıklama (1-2 cümle)",
  "follow_up_interval_weeks": 12
}

Kurallar:
- Türkçe yaz
- Kesin tanı değil "değerlendirme/öneri" terminolojisi kullan
- Genel simetri skoru yüksek olsa bile bölgesel bulgulara bak:
  * Herhangi bir bölgede severity "moderate" veya "severe" ise o bölge için tedavi öner
  * Tüm bölgeler "none" veya "mild" ise tedavi önerisine gerek yok

Severity eşikleri (mm cinsinden ölçümler için):
  none=<1mm | mild=1-2mm | moderate=2-4mm | severe=4mm+

Orta Hat Açısı severity eşiği (derece cinsinden — mm ile KARIŞTIRILMAZ):
  none=<1° | mild=1-2° | moderate=2-4° | severe=4°+

Tedavi önerilerinde "target_muscle" alanı ZORUNLU — aşağıdaki referans kasları kullan:
  Kaş bölgesi   → frontalis, corrugator supercilii, procerus
  Göz bölgesi   → orbicularis oculi (üst/alt lifler)
  Dudak/ağız    → depressor anguli oris, orbicularis oris, mentalis, risorius
  Orta hat/çene → masseter, platysma, digastric
  Yanak         → zygomaticus major/minor, buccinator
  Alın          → frontalis (medial/lateral lifler)

CİLT ve RENK BAZLI TEDAVİLER — Eğer asimetri veya bölgesel bulgular ciltle ilgiliyse
(hiperpigmentasyon, lekeleri, gözenek, kırışıklık, sarkma, cilt kalitesi) şu önerileri ekle:
  target_muscle alanına "cilt — [bölge adı]" yaz (örn: "cilt — yanak", "cilt — alın")
  Uygun tedaviler: Lazer, PRP, Mezoterapi, Kimyasal Peeling, Hyaluronik Asit Dolgu, Karboksi Terapi
  Cilt rengi/ton eşitsizliği → Lazer / Kimyasal Peeling / Aydınlatma Mezoterapi
  Yüzeysel kırışıklık       → Botulinum Toksin / Dolgu / PRP
  Cilt sarkması             → Ultrason Lifting / İplik Askı
  Her durumda en az BİR cilt kalitesi/uyum önerisi eklenmelidir

- notes alanında hangi kas veya cilt bölgesi neden seçildiğini kısaca açıkla
- SADECE JSON döndür, başka hiçbir şey yazma"""


def _build_user_prompt(metrics: dict, patient_id: int, doctor_notes: Optional[str], patient_age: Optional[int] = None) -> str:
    score     = metrics.get("symmetry_score", "N/A")
    pose_info = ""
    if metrics.get("pitch_deg") is not None:
        pose_info = (
            f"\n- Baş Pozu: Pitch {metrics['pitch_deg']:.1f}°, "
            f"Yaw {metrics['yaw_deg']:.1f}°, Roll {metrics['roll_deg']:.1f}°"
        )
    doctor_section = f"\nDoktor Notu: {doctor_notes}" if doctor_notes else ""

    midline_deg = metrics.get('midline_angle_deg', None)
    midline_str = f"{midline_deg}° (yüz dikey ekseninin sağa/sola eğimi — 4°+ belirgin, enjeksiyon/tedavi gerektirir)" \
                  if midline_deg is not None else "N/A"

    # Altın oran bölümü
    gr = metrics.get("golden_ratio") or {}
    golden_section = ""
    if gr:
        golden_section = (
            f"\n\nAltın Oran & Yüz Oranları:\n"
            f"- Yüz Üçlüsü (üst/orta/alt): {gr.get('facial_thirds_upper','?'):.1%} / "
            f"{gr.get('facial_thirds_middle','?'):.1%} / {gr.get('facial_thirds_lower','?'):.1%} "
            f"(ideal: %33/%33/%33, skor: {gr.get('thirds_score','?')}/100)\n"
            f"- Göz Genişliği / Yüz Genişliği: {gr.get('eye_width_to_face_ratio','?'):.3f} (ideal ~0.50)\n"
            f"- Burun Genişliği / İnterkantal Mesafe: {gr.get('nose_width_to_icw_ratio','?'):.3f} (ideal ~1.0)\n"
            f"- Üst/Alt Dudak Oranı: {gr.get('upper_lower_lip_ratio','?'):.3f} (ideal ~0.6)\n"
            f"- Altın Oran Genel Skoru: {gr.get('golden_ratio_score','?')}/100"
        )

    # Canthal tilt bölümü
    ct = metrics.get("canthal_tilt") or {}
    canthal_section = ""
    if ct:
        canthal_section = (
            f"\n\nCanthal Tilt (Göz Açısı):\n"
            f"- Sol göz: {ct.get('left_tilt_deg','?')}°, Sağ göz: {ct.get('right_tilt_deg','?')}°\n"
            f"- Ortalama: {ct.get('avg_tilt_deg','?')}°  |  Sınıflandırma: {ct.get('classification','?')}\n"
            f"- İki göz tilt farkı: {ct.get('tilt_symmetry_diff','?')}°"
        )

    # Yüz şekli
    fs = metrics.get("face_shape") or {}
    shape_section = ""
    if fs:
        shape_section = (
            f"\n\nYüz Şekli: {fs.get('shape','?')} ({fs.get('shape_en','?')}) "
            f"— güven: %{int(fs.get('confidence',0)*100)}\n"
            f"- Alın genişliği: {fs.get('forehead_width_mm','?')} mm  "
            f"Elmacık: {fs.get('cheekbone_width_mm','?')} mm  "
            f"Çene: {fs.get('jaw_width_mm','?')} mm  "
            f"Yüz uzunluğu: {fs.get('face_length_mm','?')} mm"
        )

    # Hacim haritası
    vm = metrics.get("volume_map") or {}
    volume_section = ""
    if vm:
        volume_section = (
            f"\n\nHacim Haritası:\n"
            f"- Şakak çöküklüğü: {vm.get('temporal_hollowing','?')}/10\n"
            f"- Elmacık dolgunluğu: {vm.get('malar_fullness','?')}/10\n"
            f"- Göz altı çukuru: {vm.get('tear_trough_depth','?')}/10\n"
            f"- Nasolabial fold: {vm.get('nasolabial_depth','?')}/10\n"
            f"- Genel hacim skoru: {vm.get('overall_volume_score','?')}/100 ({vm.get('age_indicator','?')})"
        )

    # Kırışıklık haritası
    wm = metrics.get("wrinkle_map") or {}
    wrinkle_section = ""
    if wm:
        zones = wm.get("botox_priority_zones", [])
        wrinkle_section = (
            f"\n\nKırışıklık Haritası:\n"
            f"- Alın: {wm.get('forehead_score','?')}/10  "
            f"Glabellar: {wm.get('glabellar_score','?')}/10  "
            f"Crow's feet: {wm.get('crows_feet_score','?')}/10  "
            f"Nasolabial: {wm.get('nasolabial_score','?')}/10\n"
            f"- Genel kırışıklık skoru: {wm.get('overall_score','?')}/100\n"
            f"- Botoks öncelik bölgeleri: {', '.join(zones) if zones else 'yok'}"
        )

    # Nazal analiz
    na = metrics.get("nasal_metrics") or {}
    nasal_section = ""
    if na:
        nasal_section = (
            f"\n\nNazal Analiz:\n"
            f"- Nasolabial açı: {na.get('nasolabial_angle_deg','?')}° ({na.get('assessment','?')})\n"
            f"- Burun genişliği: {na.get('nose_width_mm','?')} mm  "
            f"Uzunluk: {na.get('nose_length_mm','?')} mm  "
            f"Dorsum sapması: {na.get('dorsum_deviation_mm','?')} mm"
        )

    age_section = ""
    if patient_age:
        age_group = "genç (<35)" if patient_age < 35 else ("orta (35-50)" if patient_age < 50 else "olgun (50+)")
        age_section = (
            f"\nHasta Yaşı: {patient_age} yaş ({age_group})\n"
            f"  → Yaşa özgü not: "
            + ("Koruyucu/önleyici yaklaşım öner — dolgu yerine botoks ağırlıklı." if patient_age < 35
               else "Dengeli yaklaşım — hem botoks hem dolgu değerlendirilebilir." if patient_age < 50
               else "Restoratif yaklaşım — hacim kaybı ve sarkma öncelik, dolgu+lifting kombinasyonu değerlendir.")
        )

    return (
        f"Hasta ID: {patient_id}{age_section}\n\n"
        f"Yüz Asimetri Analiz Sonuçları:\n"
        f"- Simetri Skoru: {score}/100\n"
        f"- Kaş Yükseklik Farkı: {metrics.get('brow_height_diff_mm', 'N/A')} mm\n"
        f"- Göz Açıklık Farkı: {metrics.get('eye_width_diff_mm', 'N/A')} mm\n"
        f"- Dudak Köşe Farkı: {metrics.get('mouth_corner_diff_mm', 'N/A')} mm\n"
        f"- Orta Hat Açısı: {midline_str}"
        f"{pose_info}"
        f"{golden_section}"
        f"{canthal_section}"
        f"{shape_section}"
        f"{volume_section}"
        f"{wrinkle_section}"
        f"{nasal_section}"
        f"{doctor_section}\n\n"
        "Yukarıdaki TÜM verileri analiz ederek kapsamlı JSON formatında klinik rapor oluştur. "
        "Altın oran sapmaları, canthal tilt, yüz şekli, hacim kayıpları ve kırışıklık bölgeleri "
        "için de uygun tedavi önerileri ekle."
    )


# ─── Claude (Anthropic) ───────────────────────────────────────────────────────

_claude_client = None
if LLM_PROVIDER == "claude":
    try:
        import anthropic as _anthropic_mod
        _anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        if _anthropic_key:
            _claude_client = _anthropic_mod.AsyncAnthropic(api_key=_anthropic_key)
    except Exception:
        pass


async def _call_claude(prompt: str, image_b64: Optional[str] = None, profile_image_b64: Optional[str] = None) -> Optional[str]:
    if _claude_client is None:
        return None
    content: list = []
    if image_b64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64},
        })
    if profile_image_b64:
        content.append({"type": "text", "text": "Profil (lateral) görüntü:"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": profile_image_b64},
        })
    content.append({"type": "text", "text": prompt})
    response = await _claude_client.messages.create(
        model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    return response.content[0].text if response.content else None


# ─── OpenAI (GPT-4o) ──────────────────────────────────────────────────────────

_openai_client = None
if LLM_PROVIDER == "openai":
    try:
        from openai import AsyncOpenAI as _AsyncOpenAI
        _openai_key = os.getenv("OPENAI_API_KEY", "")
        if _openai_key:
            _openai_client = _AsyncOpenAI(api_key=_openai_key)
    except Exception:
        pass


async def _call_openai(prompt: str, image_b64: Optional[str] = None, profile_image_b64: Optional[str] = None) -> Optional[str]:
    if _openai_client is None:
        return None
    content: list = []
    if image_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}})
    if profile_image_b64:
        content.append({"type": "text", "text": "Profil (lateral) görüntü:"})
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{profile_image_b64}"}})
    content.append({"type": "text", "text": prompt})
    response = await _openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": content},
        ],
        max_tokens=1024,
        temperature=0.3,
    )
    return response.choices[0].message.content


# ─── Google Gemini ────────────────────────────────────────────────────────────

_gemini_client = None
_gemini_model_name: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if LLM_PROVIDER == "gemini":
    try:
        from google import genai as _genai
        _google_key = os.getenv("GOOGLE_API_KEY", "")
        if _google_key:
            _gemini_client = _genai.Client(api_key=_google_key)
    except Exception:
        pass


async def _call_gemini(prompt: str, image_b64: Optional[str] = None, profile_image_b64: Optional[str] = None) -> Optional[str]:
    if _gemini_client is None:
        return None
    from google.genai import types as _genai_types
    import base64 as _b64
    contents: list = []
    if image_b64:
        contents.append(_genai_types.Part.from_bytes(
            data=_b64.b64decode(image_b64),
            mime_type="image/jpeg",
        ))
    if profile_image_b64:
        contents.append("Profil (lateral) görüntü:")
        contents.append(_genai_types.Part.from_bytes(
            data=_b64.b64decode(profile_image_b64),
            mime_type="image/jpeg",
        ))
    contents.append(prompt)
    response = await _gemini_client.aio.models.generate_content(
        model=_gemini_model_name,
        contents=contents,
        config=_genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=8000,  # 2.5-flash thinking modeli için yeterli alan
            response_mime_type="application/json",  # Gemini JSON mode — markdown sarımını engeller
        ),
    )
    return response.text


# ─── Aktif provider bilgisi ───────────────────────────────────────────────────

def get_active_provider() -> str:
    """Hangi provider aktif ve API anahtarı mevcut?"""
    if LLM_PROVIDER == "claude" and _claude_client  is not None: return "claude-opus-4-6"
    if LLM_PROVIDER == "openai" and _openai_client  is not None: return "gpt-4o"
    if LLM_PROVIDER == "gemini" and _gemini_client  is not None: return f"gemini/{_gemini_model_name}"
    return "unavailable"


# ─── Ana fonksiyon ────────────────────────────────────────────────────────────

async def generate_clinical_report(
    metrics:              dict,
    patient_id:           int,
    doctor_notes:         Optional[str] = None,
    annotated_image_b64:  Optional[str] = None,
    profile_image_b64:    Optional[str] = None,
    patient_age:          Optional[int] = None,
) -> Optional[str]:
    """
    Seçili LLM provider ile klinik JSON rapor üretir.
    annotated_image_b64 verilirse frontal görsel, profile_image_b64 verilirse lateral görsel de modele gönderilir.
    Provider veya API anahtarı yoksa None döner.
    """
    prompt = _build_user_prompt(metrics, patient_id, doctor_notes, patient_age)

    if LLM_PROVIDER == "claude":
        return await _call_claude(prompt, annotated_image_b64, profile_image_b64)
    elif LLM_PROVIDER == "openai":
        return await _call_openai(prompt, annotated_image_b64, profile_image_b64)
    elif LLM_PROVIDER == "gemini":
        return await _call_gemini(prompt, annotated_image_b64, profile_image_b64)
    return None
