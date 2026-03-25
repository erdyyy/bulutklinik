/**
 * AsymmetryAnalysisPage
 * =====================
 * Doktor için yüz asimetri analiz dashboard'u.
 *
 * Akış:
 *  1. Hasta fotoğrafı yükle  (drag-drop veya dosya seç)
 *  2. OpenCV analizi çalıştır → annotated görüntü + metrikler
 *  3. AI tedavi planı üret   → doktor onayına sun
 *  4. Önce/Sonra karşılaştırma (2 fotoğraf)
 */

import React, { useCallback, useRef, useState } from "react";
import {
  analyzeAsymmetry,
  AsymmetryResult,
  generateTreatmentPlan,
  TreatmentPlanResponse,
  uploadPhoto,
} from "../../services/asymmetryApi";
import { useAuthStore } from "../../store/authStore";
import DoctorLayout from "../../components/doctor/DoctorLayout";

// ─── Yardımcı bileşenler ─────────────────────────────────────────────────── //

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, string> = {
    none:     "bg-emerald-900/40 text-emerald-300 border border-emerald-700",
    mild:     "bg-yellow-900/40  text-yellow-300  border border-yellow-700",
    moderate: "bg-orange-900/40  text-orange-300  border border-orange-700",
    severe:   "bg-red-900/40     text-red-300     border border-red-700",
  };
  const labels: Record<string, string> = {
    none: "Önemsiz", mild: "Hafif", moderate: "Orta", severe: "Belirgin",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[severity] ?? map.none}`}>
      {labels[severity] ?? severity}
    </span>
  );
};

const PriorityDot: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, string> = {
    high: "bg-red-400", medium: "bg-yellow-400", low: "bg-emerald-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full mr-2 ${map[priority] ?? "bg-gray-400"}`} />;
};

// Simetri skoru rengi
function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-yellow-400";
  return "text-red-400";
}

// Delta değeri için sol/sağ etiket
function deltaLabel(val: number, posLabel: string, negLabel: string): string {
  if (Math.abs(val) < 0.3) return "Simetrik";
  return val > 0 ? posLabel : negLabel;
}

// ─── Metrik satırı bileşeni ──────────────────────────────────────────────── //

const MetricRow: React.FC<{
  label:    string;
  delta:    number;
  posLabel: string;
  negLabel: string;
  unit?:    string;
}> = ({ label, delta, posLabel, negLabel, unit = "mm" }) => {
  const abs   = Math.abs(delta);
  const color = abs < 0.5 ? "text-emerald-400" : abs < 1.5 ? "text-yellow-400" : "text-red-400";
  const barW  = Math.min(100, (abs / 5) * 100);

  return (
    <div className="py-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono font-semibold ${color}`}>
            {delta > 0 ? "+" : ""}{delta.toFixed(2)} {unit}
          </span>
          <span className="text-xs text-gray-500 min-w-[110px] text-right">
            {deltaLabel(delta, posLabel, negLabel)}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            abs < 0.5 ? "bg-emerald-500" : abs < 1.5 ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${barW}%` }}
        />
      </div>
    </div>
  );
};

// ─── Fotoğraf yükleme alanı ──────────────────────────────────────────────── //

const PhotoDropzone: React.FC<{
  label:    string;
  preview:  string | null;
  onFile:   (f: File) => void;
  loading?: boolean;
  disabled?: boolean;
}> = ({ label, preview, onFile, loading, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile, disabled],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center
        rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
        min-h-[280px] overflow-hidden select-none
        ${disabled ? "opacity-50 cursor-not-allowed border-gray-700"
          : preview  ? "border-transparent" : "border-gray-600 hover:border-indigo-400 bg-gray-800/50"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />

      {preview ? (
        <>
          <img src={preview} alt={label} className="w-full h-full object-cover" style={{ maxHeight: 340 }} />
          {loading && (
            <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-900/80 text-xs text-gray-300 px-3 py-1 rounded-full">
            {label}
          </div>
        </>
      ) : (
        <div className="text-center p-6">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className="text-gray-600 text-xs mt-1">JPEG / PNG / WebP • Maks 10 MB</p>
          <p className="text-gray-600 text-xs">Sürükle bırak veya tıkla</p>
        </div>
      )}
    </div>
  );
};

// ─── Ana sayfa ───────────────────────────────────────────────────────────── //

type Step = "upload" | "analyzing" | "results" | "ai-report";

const AsymmetryAnalysisPage: React.FC = () => {
  const { userId } = useAuthStore();
  const doctorId   = Number(userId ?? 1);

  // Fotoğraf state'leri
  const [patientId, setPatientId] = useState<number>(0);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [_afterFile, setAfterFile]  = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview,  setAfterPreview]  = useState<string | null>(null);

  // Analiz state'leri
  const [step,     setStep]     = useState<Step>("upload");
  const [result,   setResult]   = useState<AsymmetryResult | null>(null);
  const [plan,     setPlan]     = useState<TreatmentPlanResponse | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [aiNotes,  setAiNotes]  = useState("");

  // ── Fotoğraf seçme ──────────────────────────────────────────────────── //
  const handleBeforeFile = (file: File) => {
    setBeforeFile(file);
    setBeforePreview(URL.createObjectURL(file));
    setResult(null);
    setPlan(null);
  };

  const handleAfterFile = (file: File) => {
    setAfterFile(file);
    setAfterPreview(URL.createObjectURL(file));
  };

  // ── Analizi başlat ──────────────────────────────────────────────────── //
  const runAnalysis = async () => {
    if (!beforeFile || patientId <= 0) {
      setError("Lütfen hasta ID'si girin ve fotoğraf yükleyin.");
      return;
    }
    setError(null);
    setStep("analyzing");

    try {
      const photo   = await uploadPhoto(beforeFile, patientId, doctorId, "before");
      const analysis = await analyzeAsymmetry(photo.photo_id);
      setResult(analysis);
      setStep("results");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? "Analiz sırasında hata oluştu.";
      setError(msg);
      setStep("upload");
    }
  };

  // ── AI raporu ──────────────────────────────────────────────────────── //
  const runAIReport = async () => {
    if (!result) return;
    setStep("ai-report");
    setError(null);

    try {
      const treatmentPlan = await generateTreatmentPlan({
        analysisId:  result.analysis_id,
        doctorNotes: aiNotes || undefined,
      });
      setPlan(treatmentPlan);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? "AI raporu oluşturulamadı.";
      setError(msg);
      setStep("results");
    }
  };

  // ── Sıfırla ──────────────────────────────────────────────────────────── //
  const reset = () => {
    setStep("upload"); setResult(null); setPlan(null); setError(null);
    setBeforeFile(null); setAfterFile(null);
    setBeforePreview(null); setAfterPreview(null);
  };

  // ─────────────────────────────────────────────────────────────────────── //
  //  Render                                                                  //
  // ─────────────────────────────────────────────────────────────────────── //
  return (
    <DoctorLayout
      title="AI Yüz Asimetri Analizi"
      action={
        (result || plan) ? (
          <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ↺ Yeni Analiz
          </button>
        ) : undefined
      }
    >
    <div className="text-gray-100">

      {/* ── Hata mesajı ── */}
      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  ADIM 1: Fotoğraf yükleme                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {(step === "upload" || step === "analyzing") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol panel — fotoğraflar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <PhotoDropzone
                label="Önce Fotoğrafı"
                preview={beforePreview}
                onFile={handleBeforeFile}
                loading={step === "analyzing"}
                disabled={step === "analyzing"}
              />
              <PhotoDropzone
                label="Sonra Fotoğrafı (Opsiyonel)"
                preview={afterPreview}
                onFile={handleAfterFile}
                disabled={step === "analyzing"}
              />
            </div>
          </div>

          {/* Sağ panel — ayarlar */}
          <div className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
            <h2 className="font-semibold text-gray-200">Analiz Ayarları</h2>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Hasta ID</label>
              <input
                type="number"
                min={1}
                value={patientId || ""}
                onChange={(e) => setPatientId(Number(e.target.value))}
                placeholder="Örn: 42"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 text-xs text-gray-400 space-y-2 border border-gray-700">
              <p className="font-medium text-gray-300">📌 Nasıl çalışır?</p>
              <p>1. Hastanın yüz fotoğrafını yükleyin</p>
              <p>2. MediaPipe 468 yüz noktasını tespit eder</p>
              <p>3. IPD kalibrasyonu ile mm bazlı ölçüm yapılır</p>
              <p>4. GPT-4o ile klinik rapor üretilir</p>
            </div>

            <button
              onClick={runAnalysis}
              disabled={!beforeFile || patientId <= 0 || step === "analyzing"}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-all text-sm"
            >
              {step === "analyzing" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analiz ediliyor…
                </span>
              ) : (
                "🔬 Analizi Başlat"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  ADIM 2: Analiz sonuçları                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {(step === "results" || step === "ai-report") && result && (
        <div className="space-y-6">
          {/* ── Önce / Sonra + Annotated görüntü ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Orijinal */}
            {beforePreview && (
              <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
                <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400 font-medium">
                  Orijinal Fotoğraf
                </div>
                <img src={beforePreview} alt="Önce" className="w-full object-cover" style={{ maxHeight: 300 }} />
              </div>
            )}

            {/* Annotated */}
            {result.annotated_image_b64 && (
              <div className="rounded-2xl overflow-hidden border border-indigo-800/50 bg-gray-900">
                <div className="px-4 py-2 bg-indigo-900/40 text-xs text-indigo-300 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  AI Annotasyon — Asimetri Çizgileri
                </div>
                <img
                  src={`data:image/jpeg;base64,${result.annotated_image_b64}`}
                  alt="Annotated"
                  className="w-full object-cover"
                  style={{ maxHeight: 300 }}
                />
              </div>
            )}

            {/* Sonra (varsa) */}
            {afterPreview && (
              <div className="rounded-2xl overflow-hidden border border-emerald-800/50 bg-gray-900">
                <div className="px-4 py-2 bg-emerald-900/30 text-xs text-emerald-300 font-medium">
                  Sonra Fotoğrafı
                </div>
                <img src={afterPreview} alt="Sonra" className="w-full object-cover" style={{ maxHeight: 300 }} />
              </div>
            )}
          </div>

          {/* ── Metrikler ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sol: Ölçümler */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-200">Asimetri Ölçümleri</h2>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${scoreColor(result.symmetry_score)}`}>
                    {result.symmetry_score.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">/ 100 Simetri</div>
                </div>
              </div>

              {/* Simetri skoru çubuğu */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Asimetrik</span>
                  <span>Mükemmel Simetri</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      result.symmetry_score >= 85 ? "bg-emerald-500"
                      : result.symmetry_score >= 65 ? "bg-yellow-500"
                      : "bg-red-500"
                    }`}
                    style={{ width: `${result.symmetry_score}%` }}
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-800">
                <MetricRow label="Kaş Asimetrisi"    delta={result.eyebrow_delta_mm}    posLabel="Sol kaş yüksek"   negLabel="Sağ kaş yüksek" />
                <MetricRow label="Göz Açıklığı Farkı" delta={result.eye_delta_mm}        posLabel="Sol göz daha açık" negLabel="Sağ göz daha açık" />
                <MetricRow label="Dudak Köşesi Farkı" delta={result.lip_delta_mm}        posLabel="Sol köşe yukarı" negLabel="Sağ köşe yukarı" />
                <MetricRow label="Burun Sapması"      delta={result.nose_deviation_mm}   posLabel="Sağa doğru"      negLabel="Sola doğru" />
                <MetricRow label="Orta Hat Sapması"   delta={result.midline_deviation_mm} posLabel="Sağa doğru"     negLabel="Sola doğru" />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>Kalibrasyon: <span className="text-gray-400">{result.px_per_mm.toFixed(2)} px/mm</span></span>
                <span className="text-right">Analiz ID: <span className="text-gray-400">#{result.analysis_id}</span></span>
              </div>
            </div>

            {/* Sağ: AI Rapor üretme veya sonuç */}
            {step === "results" && !plan && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col justify-between">
                <div>
                  <h2 className="font-semibold text-gray-200 mb-2">AI Klinik Rapor</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    GPT-4o, ölçüm verilerini analiz ederek doktorunuz için profesyonel
                    bir klinik rapor ve tedavi önerileri oluşturur.
                  </p>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Doktor Notu (opsiyonel)
                    </label>
                    <textarea
                      rows={4}
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      placeholder="Özel notlar, hasta şikayetleri, kontraendikasyonlar…"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
                <button
                  onClick={runAIReport}
                  className="mt-4 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all"
                >
                  ✨ AI Raporu Oluştur
                </button>
              </div>
            )}

            {/* AI Raporu yükleniyor */}
            {step === "ai-report" && !plan && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-violet-800/40 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm text-center">
                  GPT-4o klinik raporu hazırlıyor…
                  <br />
                  <span className="text-gray-600 text-xs">Bu işlem ~10-20 saniye sürebilir</span>
                </p>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/*  AI Klinik Raporu                                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {plan && (
            <div className="bg-gray-900 rounded-2xl border border-violet-800/40 overflow-hidden">
              {/* Başlık */}
              <div className="px-6 py-4 bg-violet-900/30 flex items-center justify-between border-b border-violet-800/30">
                <div>
                  <h2 className="font-semibold text-violet-200 flex items-center gap-2">
                    ✨ AI Klinik Tedavi Raporu
                  </h2>
                  <p className="text-xs text-violet-400 mt-0.5">
                    {plan.ai_model} · {plan.prompt_tokens + plan.completion_tokens} token
                    {plan.is_approved && " · ✅ Doktor Onaylı"}
                  </p>
                </div>
                {!plan.is_approved && (
                  <div className="text-xs bg-yellow-900/40 border border-yellow-700 text-yellow-300 px-3 py-1 rounded-full">
                    ⏳ Onay Bekliyor
                  </div>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Genel değerlendirme */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Genel Klinik Değerlendirme</h3>
                  <p className="text-sm text-gray-400 leading-relaxed bg-gray-800/60 rounded-xl p-4">
                    {plan.clinical_summary}
                  </p>
                </div>

                {/* Bölgesel bulgular */}
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Bölgesel Bulgular</h3>
                  <div className="space-y-2">
                    {plan.regional_findings.map((f, i) => (
                      <div key={i} className="flex items-start justify-between bg-gray-800/60 rounded-lg px-3 py-2 gap-2">
                        <div>
                          <p className="text-xs font-medium text-gray-300 capitalize">{f.region}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{f.finding}</p>
                        </div>
                        <SeverityBadge severity={f.severity} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tedavi önerileri */}
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Tedavi Önerileri</h3>
                  <div className="space-y-2">
                    {plan.recommendations.map((r, i) => (
                      <div key={i} className="bg-gray-800/60 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 mb-1">
                          <PriorityDot priority={r.priority} />
                          <span className="text-xs font-medium text-gray-300">{r.treatment}</span>
                          {r.estimated_units && (
                            <span className="ml-auto text-xs text-indigo-400 font-mono">{r.estimated_units}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 ml-4">{r.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hasta iletişimi */}
                {plan.patient_communication && (
                  <div className="lg:col-span-2 bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-emerald-300 mb-1">
                      💬 Hasta ile Paylaşılabilecek Özet
                    </h3>
                    <p className="text-sm text-emerald-200/70 leading-relaxed">
                      {plan.patient_communication}
                    </p>
                  </div>
                )}

                {/* Kontraendikasyon */}
                {plan.contraindications && (
                  <div className="lg:col-span-2 bg-red-900/20 border border-red-800/40 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-red-300 mb-1">⚠️ Kontraendikasyonlar</h3>
                    <p className="text-sm text-red-200/70">{plan.contraindications}</p>
                  </div>
                )}

                {/* Takip */}
                <div className="lg:col-span-2 flex items-center gap-3 pt-2 border-t border-gray-800">
                  <span className="text-sm text-gray-400">
                    📅 Önerilen takip aralığı:
                    <span className="text-white font-medium ml-1">
                      {plan.follow_up_interval_weeks} hafta
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </DoctorLayout>
  );
};

export default AsymmetryAnalysisPage;
