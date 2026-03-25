/**
 * Integration API — API Key & Webhook yönetimi
 * Base: http://localhost:8001/api/v1/integration
 */
const BASE = "http://localhost:8001/api/v1/integration";

export interface ApiKeyInfo {
  api_key:    string;
  created_at: string;
  doctor_id:  string;
}

export interface WebhookConfig {
  url:           string;
  secret_hint:   string;
  events:        string[];
  configured_at: string;
}

export interface WebhookLog {
  event:       string;
  url:         string;
  status_code: number | null;
  success:     boolean;
  message:     string;
  timestamp:   string;
}

export interface WebhookTestResult {
  success:     boolean;
  status_code: number | null;
  message:     string;
  sent_at:     string;
}

export const integrationApi = {
  /** Yeni API anahtarı üret */
  generateApiKey: async (doctorId: string): Promise<ApiKeyInfo> => {
    const r = await fetch(`${BASE}/apikey/generate?doctor_id=${doctorId}`, { method: "POST" });
    if (!r.ok) throw new Error("API anahtarı üretilemedi");
    return r.json();
  },

  /** Mevcut API anahtarını getir (maskelenmiş) */
  getApiKey: async (doctorId: string): Promise<ApiKeyInfo | null> => {
    const r = await fetch(`${BASE}/apikey?doctor_id=${doctorId}`);
    if (!r.ok) return null;
    return r.json();
  },

  /** Webhook URL kaydet */
  saveWebhook: async (
    doctorId: string,
    url: string,
    secret: string,
    events: string[]
  ): Promise<WebhookConfig> => {
    const r = await fetch(`${BASE}/webhook?doctor_id=${doctorId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret: secret || undefined, events }),
    });
    if (!r.ok) throw new Error("Webhook kaydedilemedi");
    return r.json();
  },

  /** Mevcut webhook konfigürasyonu */
  getWebhook: async (doctorId: string): Promise<WebhookConfig | null> => {
    const r = await fetch(`${BASE}/webhook?doctor_id=${doctorId}`);
    if (!r.ok) return null;
    return r.json();
  },

  /** Webhook sil */
  deleteWebhook: async (doctorId: string): Promise<void> => {
    await fetch(`${BASE}/webhook?doctor_id=${doctorId}`, { method: "DELETE" });
  },

  /** Test payload gönder */
  testWebhook: async (doctorId: string): Promise<WebhookTestResult> => {
    const r = await fetch(`${BASE}/webhook/test?doctor_id=${doctorId}`, { method: "POST" });
    if (!r.ok) throw new Error("Test gönderilemedi");
    return r.json();
  },

  /** Son webhook gönderim logları */
  getWebhookLogs: async (doctorId: string): Promise<WebhookLog[]> => {
    const r = await fetch(`${BASE}/webhook/logs?doctor_id=${doctorId}`);
    if (!r.ok) return [];
    return r.json();
  },
};
