"""
Replicate Tedavi Simülasyonu
============================
Hastanın yüz fotoğrafını alır, tedavi önerilerine göre
"sonrası nasıl görünür" tahmini bir görsel üretir.

Model: black-forest-labs/flux-kontext-pro (img2img, yüz düzenleme)
"""

import base64
import os
import httpx
import asyncio
from typing import Optional

REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
REPLICATE_API_URL   = "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions"

# Tedavi tipine göre prompt şablonları
TREATMENT_PROMPTS: dict[str, str] = {
    "botoks": (
        "same person, after botox treatment, "
        "smoother forehead, relaxed frown lines, subtle natural result, "
        "realistic photo, same lighting same background"
    ),
    "dolgu": (
        "same person, after dermal filler treatment, "
        "fuller lips, enhanced cheekbones, restored facial volume, "
        "natural result, realistic photo, same lighting same background"
    ),
    "prp": (
        "same person, after PRP treatment, "
        "brighter skin, reduced dark circles, improved skin texture, "
        "glowing complexion, realistic photo, same lighting"
    ),
    "mezo": (
        "same person, after mesotherapy treatment, "
        "hydrated skin, reduced fine lines, improved skin tone, "
        "realistic photo, same lighting"
    ),
    "genel": (
        "same person, after aesthetic treatment, "
        "refreshed appearance, natural improvement, "
        "realistic photo, same lighting same background"
    ),
}

NEGATIVE_PROMPT = (
    "cartoon, anime, painting, unrealistic, deformed, "
    "different person, heavy makeup, filter, distorted"
)


def _build_prompt(recommendations: list[dict]) -> str:
    """Önerilerdeki tedavi tiplerine göre uygun prompt seç."""
    treatments = [r.get("treatment", "").lower() for r in recommendations]
    combined   = " ".join(treatments)

    if "botoks" in combined or "botulinum" in combined:
        base = TREATMENT_PROMPTS["botoks"]
    elif "dolgu" in combined or "filler" in combined:
        base = TREATMENT_PROMPTS["dolgu"]
    elif "prp" in combined:
        base = TREATMENT_PROMPTS["prp"]
    elif "mezo" in combined:
        base = TREATMENT_PROMPTS["mezo"]
    else:
        base = TREATMENT_PROMPTS["genel"]

    # Bölge bilgisi ekle
    regions = list({r.get("region", "") for r in recommendations if r.get("region")})
    if regions:
        region_str = ", ".join(regions)
        base += f", focus on {region_str} area"

    return base


async def simulate_treatment(
    image_b64: str,
    recommendations: list[dict],
    strength: float = 0.45,
) -> Optional[str]:
    """
    Hastanın fotoğrafını Replicate'e gönderir, simüle edilmiş görseli
    base64 string olarak döner. Hata durumunda None döner.

    image_b64   : data:image/jpeg;base64,... veya saf base64
    recommendations: plan.recommendations listesi
    strength    : 0.0 (hiç değişme) – 1.0 (tamamen yeniden üret)
                  0.4–0.5 yüz simülasyonu için dengeli değer
    """
    if not REPLICATE_API_TOKEN:
        raise ValueError("REPLICATE_API_TOKEN ayarlanmamış")

    # data URI prefix'i temizle
    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]

    prompt = _build_prompt(recommendations)

    headers = {
        "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
        "Content-Type":  "application/json",
        "Prefer":        "wait",          # sync response, max 60s bekle
    }

    payload = {
        "input": {
            "prompt":          prompt,
            "input_image":     f"data:image/jpeg;base64,{image_b64}",
            "aspect_ratio":    "match_input_image",
            "output_format":   "jpeg",
            "output_quality":  85,
            "safety_tolerance": 2,
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Prediction oluştur
        resp = await client.post(REPLICATE_API_URL, json=payload, headers=headers)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Replicate API hatası: {resp.status_code} — {resp.text[:300]}")

        data = resp.json()

        # "Prefer: wait" ile sync sonuç — output direkt URL listesi olabilir
        output = data.get("output")
        if not output and data.get("status") not in ("succeeded",):
            # Polling gerekebilir
            prediction_url = data.get("urls", {}).get("get") or f"https://api.replicate.com/v1/predictions/{data['id']}"
            output = await _poll(client, prediction_url, headers)

        if not output:
            return None

        # output URL listesi veya tek URL
        image_url = output[0] if isinstance(output, list) else output

        # Görseli indir ve base64'e çevir
        img_resp = await client.get(image_url)
        if img_resp.status_code != 200:
            return None

        return base64.b64encode(img_resp.content).decode("utf-8")


async def _poll(
    client: httpx.AsyncClient,
    url: str,
    headers: dict,
    max_tries: int = 30,
    interval: float = 2.0,
) -> Optional[list]:
    """Prediction tamamlanana kadar polling yap."""
    for _ in range(max_tries):
        await asyncio.sleep(interval)
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            break
        body = r.json()
        status = body.get("status")
        if status == "succeeded":
            return body.get("output")
        if status in ("failed", "canceled"):
            raise RuntimeError(f"Replicate prediction başarısız: {body.get('error')}")
    return None
