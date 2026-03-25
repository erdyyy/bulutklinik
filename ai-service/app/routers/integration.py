"""
Integration Router
==================
API Key yönetimi, Webhook konfigürasyonu ve dışa aktarma.

POST /api/v1/integration/apikey/generate   → Yeni API anahtarı üret
GET  /api/v1/integration/apikey            → Mevcut anahtarı göster (maskelenmiş)
POST /api/v1/integration/webhook           → Webhook URL kaydet
GET  /api/v1/integration/webhook           → Mevcut webhook konfigürasyonu
DELETE /api/v1/integration/webhook         → Webhook sil
POST /api/v1/integration/webhook/test      → Test payload gönder
GET  /api/v1/integration/webhook/logs      → Son gönderimler
"""

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/integration", tags=["integration"])

# ── In-memory store (restart'ta sıfırlanır — prod'da DB kullanılmalı) ─────────
_api_keys: dict        = {}   # api_key → doctor_id
_doctor_api_keys: dict = {}   # doctor_id → api_key + meta
_webhook_configs: dict = {}   # doctor_id → {url, secret, events, configured_at}
_webhook_logs: dict    = {}   # doctor_id → [log_entry, ...]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ApiKeyResponse(BaseModel):
    api_key:    str
    created_at: str
    doctor_id:  str

class WebhookConfigIn(BaseModel):
    url:    str
    secret: Optional[str] = None
    events: List[str]     = ["analysis.completed", "plan.generated"]

class WebhookConfigOut(BaseModel):
    url:          str
    secret_hint:  str
    events:       List[str]
    configured_at: str

class WebhookTestResponse(BaseModel):
    success:     bool
    status_code: Optional[int]
    message:     str
    sent_at:     str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _mask_secret(secret: str) -> str:
    if len(secret) < 8:
        return "••••"
    return secret[:4] + "••••" + secret[-4:]


def _mask_key(key: str) -> str:
    """bk_live_<hex48>  →  bk_live_xxxx••••xxxx"""
    if len(key) <= 20:
        return key
    return key[:16] + "•" * (len(key) - 20) + key[-4:]


def _sign(secret: str, payload: str) -> str:
    return "sha256=" + hmac.new(
        secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


async def _send_webhook(doctor_id: str, event: str, data: dict, force: bool = False) -> dict:
    cfg = _webhook_configs.get(str(doctor_id))
    if not cfg:
        return {"success": False, "message": "Webhook yapılandırılmamış"}
    if not force and event not in cfg.get("events", []):
        return {"success": False, "message": f"Event '{event}' aktif değil"}

    url    = cfg["url"]
    secret = cfg.get("secret", "")
    payload_dict = {"event": event, "timestamp": _now(), "data": data}
    payload_str  = json.dumps(payload_dict, ensure_ascii=False)

    headers = {
        "Content-Type": "application/json",
        "X-BulutKlinik-Event": event,
        "User-Agent": "BulutKlinik-Webhook/1.0",
    }
    if secret:
        headers["X-BulutKlinik-Signature"] = _sign(secret, payload_str)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, content=payload_str, headers=headers)
        success = 200 <= resp.status_code < 300
        log = {"event": event, "url": url,
               "status_code": resp.status_code, "success": success,
               "message": f"HTTP {resp.status_code}", "timestamp": _now()}
    except Exception as exc:
        success = False
        log = {"event": event, "url": url,
               "status_code": None, "success": False,
               "message": str(exc), "timestamp": _now()}

    logs = _webhook_logs.setdefault(str(doctor_id), [])
    logs.insert(0, log)
    _webhook_logs[str(doctor_id)] = logs[:50]
    return log


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/apikey/generate", response_model=ApiKeyResponse)
def generate_api_key(doctor_id: str = "0"):
    key = "bk_live_" + secrets.token_hex(24)
    _api_keys[key] = str(doctor_id)
    _doctor_api_keys[str(doctor_id)] = {
        "raw": key, "created_at": _now()
    }
    return ApiKeyResponse(api_key=key, created_at=_now(), doctor_id=str(doctor_id))


@router.get("/apikey")
def get_api_key(doctor_id: str = "0"):
    meta = _doctor_api_keys.get(str(doctor_id))
    if not meta:
        return None
    return ApiKeyResponse(
        api_key=_mask_key(meta["raw"]),
        created_at=meta["created_at"],
        doctor_id=str(doctor_id),
    )


@router.post("/webhook", response_model=WebhookConfigOut)
def configure_webhook(config: WebhookConfigIn, doctor_id: str = "0"):
    secret = config.secret or secrets.token_hex(20)
    _webhook_configs[str(doctor_id)] = {
        "url": config.url,
        "secret": secret,
        "events": config.events,
        "configured_at": _now(),
    }
    return WebhookConfigOut(
        url=config.url,
        secret_hint=_mask_secret(secret),
        events=config.events,
        configured_at=_now(),
    )


@router.get("/webhook")
def get_webhook(doctor_id: str = "0"):
    cfg = _webhook_configs.get(str(doctor_id))
    if not cfg:
        return None
    return WebhookConfigOut(
        url=cfg["url"],
        secret_hint=_mask_secret(cfg.get("secret", "")),
        events=cfg.get("events", []),
        configured_at=cfg.get("configured_at", _now()),
    )


@router.delete("/webhook")
def delete_webhook(doctor_id: str = "0"):
    _webhook_configs.pop(str(doctor_id), None)
    return {"deleted": True}


@router.post("/webhook/test", response_model=WebhookTestResponse)
async def test_webhook(doctor_id: str = "0"):
    from fastapi import HTTPException
    if str(doctor_id) not in _webhook_configs:
        raise HTTPException(404, "Webhook konfigürasyonu bulunamadı.")
    result = await _send_webhook(str(doctor_id), "webhook.test", {
        "message": "BulutKlinik webhook test başarılı",
        "doctor_id": str(doctor_id),
    }, force=True)
    return WebhookTestResponse(
        success=result["success"],
        status_code=result.get("status_code"),
        message=result.get("message", ""),
        sent_at=_now(),
    )


@router.get("/webhook/logs")
def get_webhook_logs(doctor_id: str = "0"):
    return _webhook_logs.get(str(doctor_id), [])


# ── Internal trigger helpers (kullanım: photos.py'den import edilir) ──────────

async def trigger_analysis_webhook(doctor_id: str, data: dict):
    """Analiz tamamlandığında webhook tetikle."""
    await _send_webhook(str(doctor_id), "analysis.completed", data)


async def trigger_plan_webhook(doctor_id: str, data: dict):
    """Tedavi planı oluşturulduğunda webhook tetikle."""
    await _send_webhook(str(doctor_id), "plan.generated", data)
