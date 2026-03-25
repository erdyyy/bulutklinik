/**
 * Entegrasyon Ayarları Sayfası
 * ─────────────────────────────
 * • API Key yönetimi (generate / copy)
 * • Webhook konfigürasyonu (URL, secret, events)
 * • Test payload gönderimi + log görüntüleyici
 * • API dökümantasyon referansı
 */
import { useEffect, useState } from "react";
import DoctorLayout from "../../components/doctor/DoctorLayout";
import { useAuthStore } from "../../store/authStore";
import { integrationApi, WebhookConfig, WebhookLog } from "../../services/integrationApi";
import {
  Key, Webhook, TestTube2, Copy, Check, RefreshCw, Trash2,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  BookOpen, Zap, Shield, Code2,
} from "lucide-react";

// ── küçük yardımcılar ────────────────────────────────────────────────────────

function Badge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 size={11}/> Başarılı</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={11}/> Hata</span>;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Kopyala">
      {copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
    </button>
  );
}

const ALL_EVENTS = [
  { id: "analysis.completed", label: "Analiz Tamamlandı",   desc: "Yüz asimetri analizi bittiğinde" },
  { id: "plan.generated",     label: "Plan Oluşturuldu",    desc: "AI tedavi planı üretildiğinde" },
  { id: "webhook.test",       label: "Test",                desc: "Manuel test gönderimi" },
];

// ── Ana sayfa ─────────────────────────────────────────────────────────────────

export default function IntegrationSettingsPage() {
  const { userId } = useAuthStore();
  const doctorId   = userId ?? "0";

  // ── API Key state ──────────────────────────────────────────────────────────
  const [apiKey,        setApiKey]        = useState<string | null>(null);
  const [rawApiKey,     setRawApiKey]     = useState<string | null>(null); // sadece üretim anında
  const [keyLoading,    setKeyLoading]    = useState(false);
  const [keyGenerated,  setKeyGenerated]  = useState(false);

  // ── Webhook state ──────────────────────────────────────────────────────────
  const [webhookUrl,    setWebhookUrl]    = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedEvts,  setSelectedEvts]  = useState<string[]>(["analysis.completed","plan.generated"]);
  const [savedWebhook,  setSavedWebhook]  = useState<WebhookConfig | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [testLoading,   setTestLoading]   = useState(false);
  const [testResult,    setTestResult]    = useState<{success:boolean; message:string} | null>(null);

  // ── Logs state ─────────────────────────────────────────────────────────────
  const [logs,          setLogs]          = useState<WebhookLog[]>([]);
  const [logsOpen,      setLogsOpen]      = useState(false);
  const [logsLoading,   setLogsLoading]   = useState(false);

  // ── Docs open ─────────────────────────────────────────────────────────────
  const [docsOpen,      setDocsOpen]      = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    integrationApi.getApiKey(doctorId).then(info => {
      if (info) setApiKey(info.api_key);
    });
    integrationApi.getWebhook(doctorId).then(cfg => {
      if (cfg) {
        setSavedWebhook(cfg);
        setWebhookUrl(cfg.url);
        setSelectedEvts(cfg.events);
      }
    });
    integrationApi.getWebhookLogs(doctorId).then(setLogs);
  }, [doctorId]);

  // ── API Key ───────────────────────────────────────────────────────────────
  const handleGenerateKey = async () => {
    setKeyLoading(true);
    try {
      const info = await integrationApi.generateApiKey(doctorId);
      setRawApiKey(info.api_key);
      setApiKey(info.api_key);
      setKeyGenerated(true);
    } finally {
      setKeyLoading(false);
    }
  };

  // ── Webhook save ──────────────────────────────────────────────────────────
  const handleSaveWebhook = async () => {
    if (!webhookUrl) return;
    setWebhookSaving(true);
    try {
      const cfg = await integrationApi.saveWebhook(doctorId, webhookUrl, webhookSecret, selectedEvts);
      setSavedWebhook(cfg);
      setTestResult(null);
    } catch {
      // handled
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm("Webhook konfigürasyonunu silmek istiyor musunuz?")) return;
    await integrationApi.deleteWebhook(doctorId);
    setSavedWebhook(null);
    setWebhookUrl("");
    setWebhookSecret("");
  };

  // ── Test webhook ──────────────────────────────────────────────────────────
  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await integrationApi.testWebhook(doctorId);
      setTestResult({ success: r.success, message: r.message });
      const updated = await integrationApi.getWebhookLogs(doctorId);
      setLogs(updated);
      setLogsOpen(true);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  // ── Toggle event ──────────────────────────────────────────────────────────
  const toggleEvent = (id: string) =>
    setSelectedEvts(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DoctorLayout title="Entegrasyon Ayarları">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Başlık ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap size={22} className="text-white"/>
            </div>
            <div>
              <h2 className="text-lg font-bold">API & Webhook Entegrasyonu</h2>
              <p className="text-teal-100 text-sm">Mediteks, Probel, kendi sisteminizle gerçek zamanlı bağlantı</p>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <Shield size={13}/> HMAC-SHA256 imzalı
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={13}/> Gerçek zamanlı event
            </div>
          </div>
        </div>

        {/* ── API KEY ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
            <Key size={18} className="text-teal-600"/>
            <h3 className="font-semibold text-gray-800">API Anahtarı</h3>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Harici sistemlerin Medica.AI API'ye erişmesi için bearer token.
              <span className="font-medium text-gray-700"> Authorization: Bearer bk_live_...</span>
            </p>

            {apiKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                  {rawApiKey ?? apiKey}
                </div>
                <CopyBtn value={rawApiKey ?? apiKey}/>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 italic">
                Henüz API anahtarı üretilmedi
              </div>
            )}

            {keyGenerated && rawApiKey && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <Shield size={15} className="mt-0.5 flex-shrink-0"/>
                <span>Bu anahtarı şimdi kopyalayın. Sayfa yenilenince maskelenmiş gösterilecek.</span>
              </div>
            )}

            <button
              onClick={handleGenerateKey}
              disabled={keyLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {keyLoading
                ? <RefreshCw size={14} className="animate-spin"/>
                : <Key size={14}/>}
              {apiKey ? "Yeni Anahtar Üret" : "Anahtar Üret"}
            </button>
          </div>
        </section>

        {/* ── WEBHOOK ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <Webhook size={18} className="text-teal-600"/>
              <h3 className="font-semibold text-gray-800">Webhook</h3>
            </div>
            {savedWebhook && (
              <button
                onClick={handleDeleteWebhook}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={12}/> Kaldır
              </button>
            )}
          </div>
          <div className="p-6 space-y-5">

            {savedWebhook && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 size={15} className="flex-shrink-0"/>
                <span>Aktif: <span className="font-mono font-medium">{savedWebhook.url}</span></span>
              </div>
            )}

            {/* URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Endpoint URL *
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://sizin-sisteminiz.com/webhook"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            {/* Secret */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                İmzalama Secret <span className="text-gray-400 normal-case font-normal">(boş bırakılırsa otomatik üretilir)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  placeholder={savedWebhook ? savedWebhook.secret_hint : "whsec_..."}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                />
                {savedWebhook?.secret_hint && (
                  <CopyBtn value={savedWebhook.secret_hint}/>
                )}
              </div>
            </div>

            {/* Events */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dinlenecek Eventler
              </label>
              <div className="space-y-2">
                {ALL_EVENTS.filter(e => e.id !== "webhook.test").map(evt => (
                  <label key={evt.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedEvts.includes(evt.id)}
                      onChange={() => toggleEvent(evt.id)}
                      className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-teal-700">{evt.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{evt.desc}</span>
                    </div>
                    <code className="ml-auto text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">
                      {evt.id}
                    </code>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSaveWebhook}
                disabled={!webhookUrl || webhookSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-40"
              >
                {webhookSaving
                  ? <RefreshCw size={14} className="animate-spin"/>
                  : <Check size={14}/>}
                Kaydet
              </button>

              {savedWebhook && (
                <button
                  onClick={handleTest}
                  disabled={testLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-40"
                >
                  {testLoading
                    ? <RefreshCw size={14} className="animate-spin"/>
                    : <TestTube2 size={14}/>}
                  Test Gönder
                </button>
              )}
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                {testResult.success
                  ? <CheckCircle2 size={15}/>
                  : <XCircle size={15}/>}
                {testResult.message}
              </div>
            )}
          </div>
        </section>

        {/* ── WEBHOOK LOGS ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => {
              setLogsOpen(v => !v);
              if (!logsOpen) {
                setLogsLoading(true);
                integrationApi.getWebhookLogs(doctorId).then(l => { setLogs(l); setLogsLoading(false); });
              }
            }}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-teal-600"/>
              <h3 className="font-semibold text-gray-800">Son Gönderimler</h3>
              {logs.length > 0 && (
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{logs.length}</span>
              )}
            </div>
            {logsOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
          </button>

          {logsOpen && (
            <div className="border-t border-gray-50">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin"/> Yükleniyor…
                </div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  Henüz gönderim yok
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
                      <Badge ok={log.success}/>
                      <code className="text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded font-mono">
                        {log.event}
                      </code>
                      {log.status_code && (
                        <span className={`text-xs font-mono font-semibold ${log.success ? "text-emerald-600" : "text-red-600"}`}>
                          {log.status_code}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 truncate ml-auto">
                        {new Date(log.timestamp).toLocaleString("tr-TR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── DÖKÜMAN ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setDocsOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-teal-600"/>
              <h3 className="font-semibold text-gray-800">API Referansı</h3>
            </div>
            {docsOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
          </button>

          {docsOpen && (
            <div className="border-t border-gray-50 p-6 space-y-5 text-sm">

              {/* Base URL */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Base URL</p>
                <code className="block bg-gray-900 text-emerald-400 px-4 py-3 rounded-xl font-mono text-xs">
                  http://localhost:8001/api/v1
                </code>
              </div>

              {/* Auth */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kimlik Doğrulama</p>
                <code className="block bg-gray-900 text-amber-300 px-4 py-3 rounded-xl font-mono text-xs whitespace-pre">{`Authorization: Bearer bk_live_<API_KEY>`}</code>
              </div>

              {/* Webhook payload */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Webhook Payload — analysis.completed</p>
                <code className="block bg-gray-900 text-blue-300 px-4 py-3 rounded-xl font-mono text-xs whitespace-pre">{`{
  "event": "analysis.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "analysis_id": 1234567,
    "patient_id": 42,
    "symmetry_score": 78.5,
    "eyebrow_delta_mm": 2.1,
    "lip_delta_mm": 1.4,
    "midline_deviation_mm": 1.8,
    "status": "completed"
  }
}`}</code>
              </div>

              {/* Signature verification */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">İmza Doğrulama (Python)</p>
                <code className="block bg-gray-900 text-purple-300 px-4 py-3 rounded-xl font-mono text-xs whitespace-pre">{`import hmac, hashlib

def verify(payload: str, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# Header: X-Medica.AI-Signature`}</code>
              </div>

              <a
                href="http://localhost:8001/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm"
              >
                <Code2 size={14}/> Swagger UI'yi aç →
              </a>
            </div>
          )}
        </section>

      </div>
    </DoctorLayout>
  );
}
