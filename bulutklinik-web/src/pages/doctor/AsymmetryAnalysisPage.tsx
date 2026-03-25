/**
 * AsymmetryAnalysisPage
 * =====================
 * Doktor için yüz asimetri analiz dashboard'u.
 *
 * Akış:
 *  1. Hasta fotoğrafı yükle  (drag-drop veya dosya seç)
 *  2. OpenCV analizi çalıştır → annotated görüntü + metrikler
 *  3. AI tedavi planı üret   → doktor onayına sun
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyzeAsymmetry,
  AsymmetryResult,
  CanthalTiltMetrics,
  FaceShapeResult,
  GoldenRatioMetrics,
  generateTreatmentPlan,
  NasalMetrics,
  RegionalFinding,
  TreatmentPin,
  TreatmentPlanResponse,
  uploadPhoto,
  VolumeMapMetrics,
  WrinkleMapMetrics,
} from "../../services/asymmetryApi";
import { exportReportAsPdf } from "../../utils/exportReport";
import { useAuthStore } from "../../store/authStore";
import DoctorLayout from "../../components/doctor/DoctorLayout";
import { SessionHistoryDrawer } from "./SessionHistoryDrawer";
import ShareQrModal from "../../components/doctor/ShareQrModal";
import BeforeAfterSlider from "../../components/doctor/BeforeAfterSlider";
import {
  type AnalysisSession,
  blobUrlToDataUrl,
  createThumbnail,
  sessionSave,
  sessionsForPatient,
} from "../../services/sessionStore";

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
  return <span className={`inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 ${map[priority] ?? "bg-gray-400"}`} />;
};

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-yellow-400";
  return "text-red-400";
}

// ─── Yardımcı: küçük bar ─────────────────────────────────────────────────── //
const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-0.5">
    <div className={`h-full rounded-full transition-all duration-700 ${color}`}
         style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
  </div>
);

// ─── Yeni Estetik Metrikler Paneli (tabbed) ───────────────────────────────── //

const AestheticMetricsPanel: React.FC<{ result: AsymmetryResult }> = ({ result }) => {
  const [tab, setTab] = useState<"golden"|"canthal"|"shape"|"volume"|"wrinkle"|"nasal">("golden");

  const tabs: { key: typeof tab; label: string; icon: string; available: boolean }[] = [
    { key: "golden",  label: "Altın Oran",   icon: "✦", available: !!result.golden_ratio  },
    { key: "canthal", label: "Canthal Tilt", icon: "👁", available: !!result.canthal_tilt  },
    { key: "shape",   label: "Yüz Şekli",   icon: "⬡", available: !!result.face_shape    },
    { key: "volume",  label: "Hacim",        icon: "◈", available: !!result.volume_map    },
    { key: "wrinkle", label: "Kırışıklık",   icon: "〰", available: !!result.wrinkle_map   },
    { key: "nasal",   label: "Burun",        icon: "⌇", available: !!result.nasal_metrics },
  ];

  const ScoreRing: React.FC<{ score: number; label: string; max?: number }> = ({ score, label, max = 100 }) => {
    const pct = Math.min(100, (score / max) * 100);
    const color = pct >= 70 ? "text-emerald-400" : pct >= 45 ? "text-yellow-400" : "text-red-400";
    return (
      <div className="flex flex-col items-center">
        <span className={`text-2xl font-bold font-mono ${color}`}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>
      </div>
    );
  };

  const RatioRow: React.FC<{ label: string; value: number; ideal: number; unit?: string }> =
    ({ label, value, ideal, unit = "" }) => {
      const diff = Math.abs(value - ideal);
      const pct  = Math.max(0, 100 - diff * 200);
      const color = pct >= 70 ? "text-emerald-400" : pct >= 45 ? "text-yellow-400" : "text-red-400";
      const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-yellow-500" : "bg-red-500";
      return (
        <div className="py-2 border-b border-gray-800/50 last:border-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{label}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-semibold ${color}`}>{value.toFixed(3)}{unit}</span>
              <span className="text-[10px] text-gray-600">ideal: {ideal}{unit}</span>
            </div>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all duration-700`}
                 style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Tab başlıkları */}
      <div className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/80 scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            disabled={!t.available}
            className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5
              ${tab === t.key
                ? "border-b-2 border-violet-500 text-violet-300 bg-violet-900/20"
                : t.available
                  ? "text-gray-500 hover:text-gray-300"
                  : "text-gray-700 cursor-not-allowed"
              }`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="p-4">

        {/* ─── Altın Oran ─── */}
        {tab === "golden" && result.golden_ratio && (() => {
          const gr: GoldenRatioMetrics = result.golden_ratio!;
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Altın Oran Analizi</h4>
                  <p className="text-xs text-gray-500">Φ = 1.618 — ideal yüz oranları</p>
                </div>
                <ScoreRing score={gr.golden_ratio_score} label="Genel Skor" />
              </div>

              {/* Yüz üçlüsü */}
              <div className="bg-gray-800/40 rounded-xl p-3 mb-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Yüz Üçlüsü (ideal 33/33/33)</p>
                <div className="flex gap-2">
                  {[
                    { label: "Üst (Alın)", value: gr.facial_thirds_upper },
                    { label: "Orta (Burun)", value: gr.facial_thirds_middle },
                    { label: "Alt (Çene)", value: gr.facial_thirds_lower },
                  ].map((seg, i) => {
                    const pct = Math.round(seg.value * 100);
                    const dev = Math.abs(pct - 33);
                    const col = dev < 3 ? "bg-emerald-500" : dev < 7 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <div key={i} className="flex-1 text-center">
                        <div className={`h-16 rounded-lg ${col} opacity-70 flex items-center justify-center`}
                             style={{ height: `${pct * 1.5}px`, minHeight: 24, maxHeight: 72 }}>
                          <span className="text-white text-xs font-bold">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{seg.label}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-1">
                  <span className={`text-xs font-mono ${gr.thirds_score >= 70 ? "text-emerald-400" : gr.thirds_score >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                    Skor: {gr.thirds_score}/100
                  </span>
                </div>
              </div>

              <div className="divide-y divide-gray-800/50">
                <RatioRow label="Göz Genişliği / Yüz Genişliği" value={gr.eye_width_to_face_ratio} ideal={0.50} />
                <RatioRow label="Burun / İnterkantal Mesafe" value={gr.nose_width_to_icw_ratio} ideal={1.0} />
                <RatioRow label="Üst / Alt Dudak Oranı" value={gr.upper_lower_lip_ratio} ideal={0.6} />
                <RatioRow label="Yüz Genişliği / Yüksekliği" value={gr.face_width_to_height_ratio} ideal={0.68} />
              </div>
            </div>
          );
        })()}

        {/* ─── Canthal Tilt ─── */}
        {tab === "canthal" && result.canthal_tilt && (() => {
          const ct: CanthalTiltMetrics = result.canthal_tilt!;
          const avgColor = ct.avg_tilt_deg > 3 ? "text-emerald-400" : ct.avg_tilt_deg < -3 ? "text-red-400" : "text-yellow-400";
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Canthal Tilt Analizi</h4>
                  <p className="text-xs text-gray-500">Göz köşesi açısı — (+) fox eye, (−) yorgun görünüm</p>
                </div>
                <div className="text-center">
                  <span className={`text-2xl font-bold font-mono ${avgColor}`}>{ct.avg_tilt_deg > 0 ? "+" : ""}{ct.avg_tilt_deg.toFixed(1)}°</span>
                  <p className="text-[10px] text-gray-500">Ort. tilt</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { side: "Sol Göz", val: ct.left_tilt_deg },
                  { side: "Sağ Göz", val: ct.right_tilt_deg },
                ].map((eye, i) => {
                  const col = eye.val > 3 ? "border-emerald-600 bg-emerald-900/20" : eye.val < -3 ? "border-red-600 bg-red-900/20" : "border-yellow-600 bg-yellow-900/20";
                  const tc  = eye.val > 3 ? "text-emerald-400" : eye.val < -3 ? "text-red-400" : "text-yellow-400";
                  return (
                    <div key={i} className={`rounded-xl border p-3 text-center ${col}`}>
                      <p className="text-xs text-gray-400 mb-1">{eye.side}</p>
                      <p className={`text-xl font-bold font-mono ${tc}`}>{eye.val > 0 ? "+" : ""}{eye.val.toFixed(1)}°</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-800/40 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Sınıflandırma</p>
                <p className={`text-sm font-medium ${avgColor}`}>{ct.classification}</p>
                <p className="text-[11px] text-gray-500 mt-1">Tilt simetrisi farkı: {ct.tilt_symmetry_diff.toFixed(2)}°</p>
              </div>

              <div className="mt-3 bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-3">
                <p className="text-[11px] text-indigo-300 leading-relaxed">
                  {ct.avg_tilt_deg > 3
                    ? "✦ Pozitif tilt — fox eye görünümü. Canthal tutturma veya temporal lifting ile daha da belirgin hale getirilebilir."
                    : ct.avg_tilt_deg < -3
                    ? "⚠ Negatif tilt — yorgun/aşağı çekilmiş görünüm. Canthoplasty, temporal lifting veya PDO iplik uygulanabilir."
                    : "◎ Nötr tilt — dengeli pozisyon. Spesifik canthal tedavi endikasyonu yok."
                  }
                </p>
              </div>
            </div>
          );
        })()}

        {/* ─── Yüz Şekli ─── */}
        {tab === "shape" && result.face_shape && (() => {
          const fs: FaceShapeResult = result.face_shape!;
          const shapeIcons: Record<string, string> = {
            oval: "⬭", yuvarlak: "○", kare: "□", kalp: "♡", elmas: "◇", dikdörtgen: "▭", üçgen: "△"
          };
          const shapeTips: Record<string, string> = {
            oval: "İdeal oran. Hemen hemen tüm tedaviler uyumludur.",
            yuvarlak: "Elmacık dolgusu ile dikey uzama etkisi yaratılabilir. Masseter botoksu yüzü inceltir.",
            kare: "Masseter botoksu ile çene hattı yumuşatılabilir. Temporal dolgu alın genişliğini dengeler.",
            kalp: "Çene ucu dolgusu ile alt yüz genişletilebilir. Alın botoksu orantıyı dengeler.",
            elmas: "Elmacık vurgusu ile şekil korunabilir. Temporal ve çene dolgusu denge sağlar.",
            dikdörtgen: "Masseter botoksu ve elmacık dolgusu ile oval forma yaklaştırılabilir.",
            üçgen: "Elmacık ve şakak dolgusu ile üst yüz genişletilebilir.",
          };
          return (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-violet-900/30 border border-violet-700/50 flex items-center justify-center text-3xl">
                  {shapeIcons[fs.shape] ?? "⬡"}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-100 capitalize">{fs.shape}</h4>
                  <p className="text-xs text-gray-500">{fs.shape_en} · güven %{Math.round(fs.confidence * 100)}</p>
                </div>
                <div className="ml-auto text-right">
                  <ScoreRing score={fs.confidence * 100} label="Güven" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Alın Genişliği",  val: fs.forehead_width_mm },
                  { label: "Elmacık Genişliği", val: fs.cheekbone_width_mm },
                  { label: "Çene Genişliği",  val: fs.jaw_width_mm },
                  { label: "Yüz Uzunluğu",   val: fs.face_length_mm },
                ].map((m, i) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500">{m.label}</p>
                    <p className="text-sm font-mono font-semibold text-gray-200">{m.val.toFixed(1)} mm</p>
                  </div>
                ))}
              </div>

              <div className="bg-violet-900/20 border border-violet-800/40 rounded-xl p-3">
                <p className="text-[11px] text-violet-300 leading-relaxed">
                  {shapeTips[fs.shape] ?? "Yüz şekline uygun tedavi planı hazırlanabilir."}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ─── Hacim Haritası ─── */}
        {tab === "volume" && result.volume_map && (() => {
          const vm: VolumeMapMetrics = result.volume_map!;
          const ageCol = vm.age_indicator === "genç" ? "text-emerald-400" : vm.age_indicator === "orta" ? "text-yellow-400" : "text-red-400";
          const zones = [
            { label: "Şakak (Temporal)",    val: vm.temporal_hollowing, desc: "Çöküklük — dolgu hedefi",  invert: true },
            { label: "Elmacık (Malar)",      val: vm.malar_fullness,     desc: "Dolgunluk — yüksek iyi",  invert: false },
            { label: "Göz Altı (Tear Trough)", val: vm.tear_trough_depth,  desc: "Çukurluk — dolgu hedefi",invert: true },
            { label: "Nasolabial Fold",      val: vm.nasolabial_depth,   desc: "Derinlik — dolgu hedefi", invert: true },
          ];
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Hacim Kaybı Haritası</h4>
                  <p className="text-xs text-gray-500">Bölgesel doku yoğunluğu analizi</p>
                </div>
                <div className="text-center">
                  <span className={`text-2xl font-bold font-mono ${vm.overall_volume_score >= 65 ? "text-emerald-400" : vm.overall_volume_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                    {vm.overall_volume_score.toFixed(0)}
                  </span>
                  <p className={`text-[10px] font-medium ${ageCol}`}>{vm.age_indicator}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {zones.map((z, i) => {
                  const barVal   = z.invert ? 10 - z.val : z.val;
                  const severity = z.invert ? z.val : 10 - z.val;
                  const barCol   = severity < 3 ? "bg-emerald-500" : severity < 6 ? "bg-yellow-500" : "bg-red-500";
                  const textCol  = severity < 3 ? "text-emerald-400" : severity < 6 ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-gray-400">{z.label}</span>
                        <span className={`text-xs font-mono ${textCol}`}>{z.val.toFixed(1)}/10</span>
                      </div>
                      <MiniBar value={barVal} max={10} color={barCol} />
                      <p className="text-[10px] text-gray-600 mt-0.5">{z.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ─── Kırışıklık Haritası ─── */}
        {tab === "wrinkle" && result.wrinkle_map && (() => {
          const wm: WrinkleMapMetrics = result.wrinkle_map!;
          const zones = [
            { label: "Alın",                   val: wm.forehead_score,   muscle: "frontalis",               icon: "━" },
            { label: "Glabellar (11 hatları)", val: wm.glabellar_score,  muscle: "corrugator supercilii",   icon: "⋮" },
            { label: "Crow's Feet",            val: wm.crows_feet_score, muscle: "orbicularis oculi",       icon: "〰" },
            { label: "Nasolabial",             val: wm.nasolabial_score, muscle: "zygomaticus / levator",   icon: "⌒" },
          ];
          const overallColor = wm.overall_score >= 70 ? "text-emerald-400" : wm.overall_score >= 40 ? "text-yellow-400" : "text-red-400";
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Kırışıklık Yoğunluk Haritası</h4>
                  <p className="text-xs text-gray-500">Laplacian kenar analizi ile bölgesel kırışıklık tespiti</p>
                </div>
                <div className="text-center">
                  <span className={`text-2xl font-bold font-mono ${overallColor}`}>{wm.overall_score.toFixed(0)}</span>
                  <p className="text-[10px] text-gray-500">Cilt Skoru /100</p>
                </div>
              </div>

              {/* Dominant zone vurgusu */}
              {wm.dominant_zone && (
                <div className="mb-3 bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-xs font-semibold text-orange-300">En Belirgin Bölge</p>
                    <p className="text-sm font-bold text-white capitalize">{wm.dominant_zone}</p>
                    <p className="text-[10px] text-orange-400/70">Botoks ile öncelikli ele alınmalı</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-3">
                {zones.map((z, i) => {
                  const barCol  = z.val < 3 ? "bg-emerald-500" : z.val < 6 ? "bg-yellow-500" : "bg-red-500";
                  const textCol = z.val < 3 ? "text-emerald-400" : z.val < 6 ? "text-yellow-400" : "text-red-400";
                  const label   = z.val < 3 ? "Minimal" : z.val < 6 ? "Orta" : "Belirgin";
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-sm">{z.icon}</span>
                          <span className="text-xs text-gray-300 font-medium">{z.label}</span>
                          <span className="text-[10px] text-gray-600 font-mono hidden sm:inline">{z.muscle}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${textCol}`}>{label}</span>
                          <span className={`text-xs font-mono font-bold ${textCol}`}>{z.val.toFixed(1)}</span>
                          <span className="text-[10px] text-gray-700">/10</span>
                        </div>
                      </div>
                      <MiniBar value={z.val} max={10} color={barCol} />
                    </div>
                  );
                })}
              </div>

              {wm.botox_priority_zones.length > 0 ? (
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1.5 font-semibold">🎯 Botoks Öncelik Sırası</p>
                  <div className="flex flex-wrap gap-1.5">
                    {wm.botox_priority_zones.map((z, i) => (
                      <span key={i} className="text-[11px] bg-amber-900/40 border border-amber-700/50 text-amber-300 px-2.5 py-1 rounded-full font-medium">
                        {i + 1}. {z}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-400">✓ Botoks gerektiren belirgin kırışıklık bölgesi tespit edilmedi</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── Nazal Analiz ─── */}
        {tab === "nasal" && result.nasal_metrics && (() => {
          const na: NasalMetrics = result.nasal_metrics!;
          const angleOk = na.nasolabial_angle_deg >= 90 && na.nasolabial_angle_deg <= 115;
          const angleCol = angleOk ? "text-emerald-400" : "text-yellow-400";
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Nazal Oran Analizi</h4>
                  <p className="text-xs text-gray-500">Nasolabial açı · alar oranlar</p>
                </div>
                <div className="text-center">
                  <span className={`text-2xl font-bold font-mono ${angleCol}`}>{na.nasolabial_angle_deg.toFixed(0)}°</span>
                  <p className="text-[10px] text-gray-500">Nasolabial</p>
                </div>
              </div>

              <div className="bg-gray-800/40 rounded-xl p-3 mb-3">
                <p className={`text-xs font-medium mb-1 ${angleOk ? "text-emerald-400" : "text-yellow-400"}`}>
                  {na.assessment}
                </p>
                <p className="text-[10px] text-gray-500">İdeal: Kadın 95-115° · Erkek 90-105°</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Burun Genişliği",  val: `${na.nose_width_mm.toFixed(1)} mm` },
                  { label: "Burun Uzunluğu",  val: `${na.nose_length_mm.toFixed(1)} mm` },
                  { label: "Genişlik/Uzunluk", val: na.nose_width_to_length.toFixed(3) },
                  { label: "Dorsum Sapması",  val: `${na.dorsum_deviation_mm.toFixed(1)} mm` },
                  { label: "Burun/Yüz Oranı", val: na.nose_to_face_width.toFixed(3) },
                  { label: "Tip Projeksiyonu", val: na.tip_projection.toFixed(3) },
                ].map((m, i) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500">{m.label}</p>
                    <p className="text-sm font-mono font-semibold text-gray-200">{m.val}</p>
                  </div>
                ))}
              </div>

              <div className="divide-y divide-gray-800/50">
                <RatioRow label="Genişlik / Uzunluk" value={na.nose_width_to_length} ideal={0.7} />
                <RatioRow label="Burun / Yüz Genişliği" value={na.nose_to_face_width} ideal={0.25} />
              </div>
            </div>
          );
        })()}

        {/* Veri yok */}
        {!result[tab === "golden" ? "golden_ratio" : tab === "canthal" ? "canthal_tilt" : tab === "shape" ? "face_shape" : tab === "volume" ? "volume_map" : tab === "wrinkle" ? "wrinkle_map" : "nasal_metrics"] && (
          <div className="text-center py-8 text-gray-600 text-sm">Analiz verisi mevcut değil.</div>
        )}
      </div>
    </div>
  );
};

// ─── Birleşik Ölçümler + Bulgular paneli ─────────────────────────────────── //

const CombinedMetricsFindingsPanel: React.FC<{
  result:   AsymmetryResult;
  findings: RegionalFinding[];
}> = ({ result, findings }) => {

  const findSeverity = (keywords: string[]): RegionalFinding | undefined =>
    findings.find(f => keywords.some(kw => f.region.toLowerCase().includes(kw)));

  const rows: {
    label: string; delta: number; unit: string;
    posLabel: string; negLabel: string;
    finding?: RegionalFinding;
  }[] = [
    { label: "Kaş Asimetrisi",     delta: result.eyebrow_delta_mm,     unit: "mm", posLabel: "Sol kaş yüksek",    negLabel: "Sağ kaş yüksek",    finding: findSeverity(["kaş"]) },
    { label: "Göz Açıklığı",       delta: result.eye_delta_mm,         unit: "mm", posLabel: "Sol göz daha açık", negLabel: "Sağ göz daha açık", finding: findSeverity(["göz"]) },
    { label: "Dudak Köşesi",       delta: result.lip_delta_mm,         unit: "mm", posLabel: "Sol köşe yukarı",   negLabel: "Sağ köşe yukarı",   finding: findSeverity(["dudak", "ağız"]) },
    { label: "Burun Sapması",      delta: result.nose_deviation_mm,    unit: "mm", posLabel: "Sağa doğru",        negLabel: "Sola doğru",        finding: findSeverity(["burun"]) },
    { label: "Orta Hat",           delta: result.midline_deviation_mm, unit: "mm", posLabel: "Sağa doğru",        negLabel: "Sola doğru",        finding: findSeverity(["orta hat", "orta"]) },
  ];

  // findings içinde metriklerle eşleşmeyen ekstra bulguları bul
  const matchedRegions = rows
    .filter(r => r.finding)
    .map(r => r.finding!.region.toLowerCase());
  const extraFindings = findings.filter(
    f => !matchedRegions.some(mr => mr === f.region.toLowerCase())
  );

  return (
    <div>
      {/* Simetri skoru */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Genel Simetri</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xl font-bold font-mono ${scoreColor(result.symmetry_score)}`}>
            {result.symmetry_score.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Asimetrik</span><span>Mükemmel</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              result.symmetry_score >= 85 ? "bg-emerald-500"
              : result.symmetry_score >= 65 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${result.symmetry_score}%` }}
          />
        </div>
      </div>

      {/* Birleşik tablo */}
      <div className="divide-y divide-gray-800/60">
        {rows.map((row, i) => {
          const abs   = Math.abs(row.delta);
          const color = abs < 0.5 ? "text-emerald-400" : abs < 1.5 ? "text-yellow-400" : "text-red-400";
          const barW  = Math.min(100, (abs / 5) * 100);
          return (
            <div key={i} className="py-2.5">
              {/* Bölge adı + ölçüm + severity */}
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-sm text-gray-300 font-medium">{row.label}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-mono font-semibold ${color}`}>
                    {row.delta > 0 ? "+" : ""}{row.delta.toFixed(2)} {row.unit}
                  </span>
                  {row.finding && <SeverityBadge severity={row.finding.severity} />}
                </div>
              </div>
              {/* Bar */}
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    abs < 0.5 ? "bg-emerald-500" : abs < 1.5 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              {/* AI klinik bulgu açıklaması */}
              {row.finding?.finding && (
                <p className="text-[11px] text-gray-500 leading-snug">
                  {row.finding.finding}
                </p>
              )}
            </div>
          );
        })}

        {/* Eşleşmeyen ekstra bulgular */}
        {extraFindings.map((f, i) => (
          <div key={`extra-${i}`} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-300 font-medium capitalize">{f.region}</span>
              <SeverityBadge severity={f.severity} />
            </div>
            {f.finding && (
              <p className="text-[11px] text-gray-500 leading-snug mt-1">{f.finding}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-600">
        <span>Kalibrasyon: <span className="text-gray-500">{result.px_per_mm.toFixed(2)} px/mm</span></span>
        <span>ID: <span className="text-gray-500">#{result.analysis_id}</span></span>
      </div>
    </div>
  );
};

// ─── Fotoğraf yükleme alanı ──────────────────────────────────────────────── //

const PhotoDropzone: React.FC<{
  label:     string;
  preview:   string | null;
  onFile:    (f: File) => void;
  loading?:  boolean;
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
        min-h-[320px] overflow-hidden select-none
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
          <img src={preview} alt={label} className="w-full h-full object-cover" style={{ maxHeight: 380 }} />
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
        <div className="text-center p-8">
          <div className="text-5xl mb-4">📷</div>
          <p className="text-gray-300 text-base font-medium mb-1">{label}</p>
          <p className="text-gray-500 text-sm">Sürükle bırak veya tıkla</p>
          <p className="text-gray-600 text-xs mt-1">JPEG / PNG / WebP · Maks 10 MB</p>
        </div>
      )}
    </div>
  );
};

// ─── Görüntü gerçek render alanını hesapla (object-contain letterbox) ──────── //

function useImageRenderBounds(
  imgRef: React.RefObject<HTMLImageElement>
): { offsetX: number; offsetY: number; renderW: number; renderH: number } | null {
  const [bounds, setBounds] = useState<{
    offsetX: number; offsetY: number; renderW: number; renderH: number;
  } | null>(null);

  const recalc = useCallback(() => {
    const el = imgRef.current;
    if (!el || !el.naturalWidth) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    const scale = Math.min(cw / nw, ch / nh);
    const rw = nw * scale;
    const rh = nh * scale;
    setBounds({
      offsetX: (cw - rw) / 2,
      offsetY: (ch - rh) / 2,
      renderW: rw,
      renderH: rh,
    });
  }, [imgRef]);

  React.useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    el.addEventListener("load", recalc);
    window.addEventListener("resize", recalc);
    recalc();
    return () => {
      el.removeEventListener("load", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, [imgRef, recalc]);

  return bounds;
}

// ─── Görüntü + interaktif pin overlay bileşeni ───────────────────────────── //

// Sadece AI asimetri annotasyon görüntüsü için — pin'siz
const AnnotatedImageWithPins: React.FC<{
  src:  string;
  alt:  string;
  // Aşağıdaki prop'lar backward compat için tutuldu, kullanılmıyor
  pins?:     TreatmentPin[];
  showPins?: boolean;
  badge?:    React.ReactNode;
}> = ({ src, alt }) => {
  return (
    <div className="relative w-full h-full" style={{ background: "#050510" }}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full block transition-opacity duration-300"
        style={{ objectFit: "contain", maxHeight: "100%" }}
      />
    </div>
  );
};

// ─── Tedavi pin overlay — controlled (split layout için) ─────────────────── //

const TreatmentPinOverlay: React.FC<{
  pins:          TreatmentPin[];
  imgRef:        React.RefObject<HTMLImageElement>;
  activePin:     number | null;
  onPinActivate: (idx: number | null) => void;
  onPinClick?:   (idx: number) => void;
}> = ({ pins, imgRef, activePin, onPinActivate, onPinClick }) => {
  const bounds = useImageRenderBounds(imgRef);
  if (!bounds) return null;
  const { offsetX, offsetY, renderW, renderH } = bounds;

  return (
    <>
      {pins.map((pin) => {
        const isActive = activePin === pin.idx;
        const px = offsetX + (pin.x_pct / 100) * renderW;
        const py = offsetY + (pin.y_pct / 100) * renderH;

        return (
          <div
            key={pin.idx}
            className="absolute"
            style={{ left: px, top: py, transform: "translate(-50%, -50%)", zIndex: isActive ? 30 : 20 }}
          >
            {/* Pulse halkası — aktifken */}
            {isActive && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-60"
                style={{ background: pin.color_hex, margin: -4 }}
              />
            )}
            <button
              onMouseEnter={() => onPinActivate(pin.idx)}
              onMouseLeave={() => onPinActivate(null)}
              onClick={() => onPinClick ? onPinClick(pin.idx) : onPinActivate(isActive ? null : pin.idx)}
              className="relative w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 transition-all duration-150 focus:outline-none"
              style={{
                backgroundColor: pin.color_hex,
                borderColor:     isActive ? "#ffffff" : `${pin.color_hex}aa`,
                transform:       isActive ? "scale(1.3)" : "scale(1)",
                boxShadow:       isActive
                  ? `0 0 0 3px ${pin.color_hex}55, 0 4px 14px rgba(0,0,0,0.8)`
                  : `0 0 0 2px ${pin.color_hex}33, 0 2px 6px rgba(0,0,0,0.6)`,
              }}
            >
              {pin.idx}
            </button>
          </div>
        );
      })}
    </>
  );
};

// ─── Tedavi Haritası Split Layout ─────────────────────────────────────────── //

// ─── Botoks Doz Veritabanı ───────────────────────────────────────────────────
const BOTOX_DB: Record<string, {
  muscle: string; muscleEN: string; minU: number; maxU: number; defaultU: number; bilateral: boolean
}[]> = {
  eyebrow:  [
    { muscle: "Corrugator Supercilii", muscleEN: "Corrugator",  minU: 5,  maxU: 25, defaultU: 12, bilateral: true  },
    { muscle: "Frontalis (medyal)",    muscleEN: "Frontalis",   minU: 5,  maxU: 20, defaultU: 10, bilateral: false },
  ],
  forehead: [
    { muscle: "Frontalis",             muscleEN: "Frontalis",   minU: 10, maxU: 30, defaultU: 15, bilateral: false },
    { muscle: "Procerus",              muscleEN: "Procerus",    minU: 5,  maxU: 10, defaultU: 5,  bilateral: false },
  ],
  eye:      [
    { muscle: "Orbicularis Oculi",     muscleEN: "Orb.Oculi",  minU: 6,  maxU: 20, defaultU: 10, bilateral: true  },
  ],
  nose:     [
    { muscle: "Nasalis",               muscleEN: "Nasalis",    minU: 4,  maxU: 10, defaultU: 5,  bilateral: false },
    { muscle: "Depressor Septi Nasi",  muscleEN: "Dep.Septi",  minU: 2,  maxU: 5,  defaultU: 2,  bilateral: false },
  ],
  lip:      [
    { muscle: "Orbicularis Oris",      muscleEN: "Orb.Oris",   minU: 4,  maxU: 8,  defaultU: 4,  bilateral: false },
    { muscle: "Dep. Anguli Oris",      muscleEN: "DAO",         minU: 4,  maxU: 10, defaultU: 5,  bilateral: true  },
  ],
  cheek:    [
    { muscle: "Zygomaticus Major",     muscleEN: "Zygomat.",   minU: 3,  maxU: 8,  defaultU: 4,  bilateral: true  },
  ],
  jaw:      [
    { muscle: "Masseter",              muscleEN: "Masseter",   minU: 20, maxU: 40, defaultU: 25, bilateral: true  },
    { muscle: "Mentalis",              muscleEN: "Mentalis",   minU: 4,  maxU: 8,  defaultU: 5,  bilateral: false },
  ],
};

type DoseRow = { id: string; region: string; muscle: string; units: number; min: number; max: number; bilateral: boolean; active: boolean };

const BotoxDoseCalculator: React.FC<{
  recommendations: { treatment: string; region: string; priority: string; estimated_units?: string | null }[];
  asymmetryDelta?: { eyebrow: number; lip: number; midline: number };
}> = ({ recommendations, asymmetryDelta }) => {
  const [rows, setRows] = useState<DoseRow[]>(() => {
    const seen = new Set<string>();
    const out: DoseRow[] = [];
    recommendations.forEach(rec => {
      const muscles = BOTOX_DB[rec.region] ?? [];
      muscles.forEach(m => {
        const id = `${rec.region}-${m.muscleEN}`;
        if (seen.has(id)) return;
        seen.add(id);
        // Asimetri şiddetine göre doz ayarı
        let extra = 0;
        if (rec.region === "eyebrow" && asymmetryDelta?.eyebrow && asymmetryDelta.eyebrow > 3) extra = 2;
        if (rec.region === "lip"     && asymmetryDelta?.lip     && asymmetryDelta.lip     > 2) extra = 1;
        out.push({
          id, region: rec.region, muscle: m.muscle,
          units: Math.min(m.defaultU + extra, m.maxU),
          min: m.minU, max: m.maxU,
          bilateral: m.bilateral, active: true,
        });
      });
    });
    // Bölge yoksa temel set ekle
    if (out.length === 0) {
      out.push(
        { id: "eyebrow-Corrugator", region: "eyebrow", muscle: "Corrugator Supercilii", units: 12, min: 5, max: 25, bilateral: true,  active: true },
        { id: "forehead-Frontalis", region: "forehead", muscle: "Frontalis",            units: 15, min: 10, max: 30, bilateral: false, active: true },
      );
    }
    return out;
  });
  const [patientWeight, setPatientWeight] = useState<number>(65);
  const [showProtocol,  setShowProtocol]  = useState(false);

  const total      = rows.filter(r => r.active).reduce((s, r) => s + r.units * (r.bilateral ? 2 : 1), 0);
  const maxSafe    = 400; // FDA önerisi üst sınır
  const safetyPct  = Math.round((total / maxSafe) * 100);

  const updateRow = (id: string, units: number) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, units } : r));
  const toggleRow = (id: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));

  const regionLabels: Record<string, string> = {
    eyebrow: "Kaş", forehead: "Alın", eye: "Göz Çevresi",
    nose: "Burun", lip: "Dudak", cheek: "Yanak", jaw: "Çene/Masseter",
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-200">💉 Botoks Doz Protokolü</p>
          <p className="text-xs text-gray-500 mt-0.5">AI önerilerine göre hesaplanmış başlangıç dozları. Klinik kararı doktora aittir.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-400">{total} Ü</p>
          <p className="text-[10px] text-gray-500">Toplam ünite</p>
        </div>
      </div>

      {/* Güvenlik bar */}
      <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400">Güvenlik Sınırı (FDA ~400 Ü)</span>
          <span className={`text-[11px] font-bold ${safetyPct > 75 ? "text-red-400" : safetyPct > 50 ? "text-amber-400" : "text-emerald-400"}`}>
            %{safetyPct}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${safetyPct > 75 ? "bg-red-500" : safetyPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(safetyPct, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">Hasta ağırlığı: {patientWeight} kg · Maks. tahmini güvenli doz referans değerdir.</p>
      </div>

      {/* Hasta ağırlığı */}
      <div className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400 w-28 flex-shrink-0">Hasta Ağırlığı (kg)</span>
        <input
          type="range" min={40} max={120} value={patientWeight}
          onChange={e => setPatientWeight(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs font-mono text-amber-400 w-10 text-right">{patientWeight}</span>
      </div>

      {/* Doz tablosu */}
      <div className="space-y-2">
        {rows.map(row => (
          <div
            key={row.id}
            className={`rounded-xl border transition-all ${
              row.active
                ? "bg-gray-800/50 border-gray-700/40"
                : "bg-gray-900/20 border-gray-800/20 opacity-40"
            }`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox" checked={row.active}
                onChange={() => toggleRow(row.id)}
                className="accent-amber-500 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-200">{row.muscle}</span>
                  <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
                    {regionLabels[row.region] ?? row.region}
                  </span>
                  {row.bilateral && (
                    <span className="text-[10px] text-violet-400 bg-violet-900/30 border border-violet-700/30 px-1.5 py-0.5 rounded">
                      bilateral
                    </span>
                  )}
                </div>
              </div>
              {/* Slider */}
              <div className="flex items-center gap-2 w-44 flex-shrink-0">
                <input
                  type="range" min={row.min} max={row.max} value={row.units}
                  disabled={!row.active}
                  onChange={e => updateRow(row.id, Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-xs font-bold text-amber-400 font-mono w-16 text-right whitespace-nowrap">
                  {row.units} Ü{row.bilateral ? ` ×2 = ${row.units * 2}` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toplam özet */}
      <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-700/30 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-amber-300">Toplam: {total} Ünite</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {rows.filter(r => r.active && r.bilateral).length} bilateral + {rows.filter(r => r.active && !r.bilateral).length} unilateral kas
          </p>
        </div>
        <button
          onClick={() => setShowProtocol(!showProtocol)}
          className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {showProtocol ? "Gizle" : "Protokol Özeti"}
        </button>
      </div>

      {/* Protokol özeti */}
      {showProtocol && (
        <div className="bg-gray-900/80 border border-gray-700/40 rounded-xl p-4 font-mono text-xs space-y-1">
          <p className="text-gray-400 mb-2 font-sans font-semibold text-sm">📄 Doz Protokolü</p>
          <p className="text-gray-500">Tarih: {new Date().toLocaleDateString("tr-TR")}</p>
          <p className="text-gray-500">Hasta ağırlığı: {patientWeight} kg</p>
          <div className="border-t border-gray-700 my-2" />
          {rows.filter(r => r.active).map(r => (
            <p key={r.id} className="text-gray-300">
              {r.muscle}{r.bilateral ? " (bilateral)" : ""}: {r.units} Ü{r.bilateral ? ` × 2 = ${r.units * 2} Ü` : ""}
            </p>
          ))}
          <div className="border-t border-gray-700 my-2" />
          <p className="text-amber-400 font-bold">TOPLAM: {total} Ünite</p>
          <p className="text-gray-600 text-[10px] mt-2">
            * Bu protokol AI analizine dayalı öneri niteliğindedir. Son karar hekime aittir.
          </p>
        </div>
      )}
    </div>
  );
};

const priorityMeta: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: "Yüksek",  color: "text-red-400",     dot: "bg-red-400"     },
  medium: { label: "Orta",    color: "text-yellow-400",  dot: "bg-yellow-400"  },
  low:    { label: "Düşük",   color: "text-emerald-400", dot: "bg-emerald-400" },
};

const TreatmentMapSplitLayout: React.FC<{
  mapSrc:          string;
  pins:            TreatmentPin[];
  recommendations: { treatment: string; region: string; priority: string;
                     target_muscle?: string | null; estimated_units?: string | null; notes?: string | null }[];
}> = ({ mapSrc, pins, recommendations }) => {
  // hoverIdx  → mouse üzerindeyken aktif
  // lockedIdx → tıklanarak sabitlenmiş (mouse çekince kaybolmaz)
  const [hoverIdx,  setHoverIdx]  = useState<number | null>(null);
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);
  const activeIdx = lockedIdx ?? hoverIdx;   // lock öncelikli

  const imgRef   = useRef<HTMLImageElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const listRef  = useRef<HTMLDivElement>(null);

  const scrollToCard = (idx: number) => {
    const el = cardRefs.current.get(idx);
    if (el && listRef.current) {
      const listTop = listRef.current.getBoundingClientRect().top;
      const cardTop = el.getBoundingClientRect().top;
      listRef.current.scrollBy({ top: cardTop - listTop - 12, behavior: "smooth" });
    }
  };

  // Pin hover (mouse üzerinde)
  const handlePinActivate = (idx: number | null) => {
    setHoverIdx(idx);
    if (idx !== null && lockedIdx === null) scrollToCard(idx);
  };

  // Pin veya kart click → lock toggle
  const handleLock = (idx: number) => {
    setLockedIdx(prev => {
      const next = prev === idx ? null : idx;
      if (next !== null) scrollToCard(next);
      return next;
    });
  };

  return (
    <div className="flex rounded-xl overflow-hidden border border-amber-800/30" style={{ height: 520 }}>

      {/* ── Sol: harita + pin'ler ── */}
      <div className="relative flex-[58] bg-gray-950 overflow-hidden">
        <img
          ref={imgRef}
          src={mapSrc}
          alt="Tedavi Haritası"
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <div className="relative w-full h-full" style={{ pointerEvents: "auto" }}>
            <TreatmentPinOverlay
              pins={pins}
              imgRef={imgRef}
              activePin={activeIdx}
              onPinActivate={handlePinActivate}
              onPinClick={handleLock}
            />
          </div>
        </div>
        {/* Sol alt: ipucu + lock göstergesi */}
        <div className="absolute bottom-2 left-2 pointer-events-none flex items-center gap-2">
          {lockedIdx !== null ? (
            <span className="text-[10px] text-amber-400 bg-gray-950/90 border border-amber-800/50 px-2 py-1 rounded-lg backdrop-blur-sm">
              📌 #{lockedIdx} sabitlendi — tekrar tıkla bırak
            </span>
          ) : (
            <span className="text-[10px] text-gray-600 bg-gray-950/80 px-2 py-1 rounded-lg backdrop-blur-sm">
              Hover veya tıkla → sabitle
            </span>
          )}
        </div>
      </div>

      {/* ── Sağ: tedavi kartları ── */}
      <div
        ref={listRef}
        className="flex-[42] overflow-y-auto bg-gray-900 border-l border-amber-900/20"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}
      >
        {/* Başlık */}
        <div className="sticky top-0 z-10 px-4 py-3 bg-gray-900/95 border-b border-gray-800 backdrop-blur-sm flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Tedavi Önerileri
          </span>
          <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-800/40 px-2 py-0.5 rounded-full">
            {recommendations.length} öneri
          </span>
        </div>

        {/* Kartlar */}
        <div className="p-3 space-y-2">
          {recommendations.map((rec, i) => {
            const pin      = pins.find(p => p.idx === i + 1);
            const isActive = activeIdx === i + 1;
            const pm       = priorityMeta[rec.priority] ?? priorityMeta.low;
            const accentHex = pin?.color_hex ?? "#6366f1";

            return (
              <div
                key={i}
                ref={el => { if (el) cardRefs.current.set(i + 1, el); }}
                onMouseEnter={() => setHoverIdx(i + 1)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => handleLock(i + 1)}
                className="rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden"
                style={{
                  borderColor:     isActive ? `${accentHex}99` : "rgba(55,65,81,0.5)",
                  backgroundColor: isActive ? `${accentHex}12`  : "rgba(31,41,55,0.5)",
                  boxShadow:       isActive ? `0 0 0 1px ${accentHex}44, 0 4px 12px rgba(0,0,0,0.4)` : "none",
                }}
              >
                {/* Üst şerit: numara + isim + doz */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  style={{ borderBottom: isActive ? `1px solid ${accentHex}33` : "1px solid transparent" }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-md"
                    style={{ background: accentHex }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-gray-100 leading-tight flex-1 min-w-0">
                    {rec.treatment}
                  </span>
                  {rec.estimated_units && (
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-900/30 border border-amber-800/40 px-1.5 py-0.5 rounded flex-shrink-0">
                      {rec.estimated_units}
                    </span>
                  )}
                </div>

                {/* Meta satırı: bölge + kas + öncelik */}
                <div className="px-3 pb-2.5 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-0.5">Bölge</p>
                    <p className="text-[11px] text-gray-300 leading-tight">📍 {rec.region}</p>
                  </div>
                  {rec.target_muscle && (
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-0.5">Kas</p>
                      <p className="text-[11px] font-mono leading-tight" style={{ color: accentHex }}>
                        {rec.target_muscle}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-0.5">Öncelik</p>
                    <p className={`text-[11px] font-medium flex items-center gap-1 ${pm.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm.dot}`} />
                      {pm.label}
                    </p>
                  </div>
                </div>

                {/* Notlar — sadece aktifken */}
                {isActive && rec.notes && (
                  <div className="px-3 pb-3">
                    <div className="border-t pt-2" style={{ borderColor: `${accentHex}33` }}>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{rec.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Yardımcı: istemci tarafında resim küçültme ───────────────────────────── //
// Büyük fotoğrafları AI servisine göndermeden önce max 800 px'e sıkıştırır.
// Bu sayede hem yükleme hızlanır hem LLM'e gönderilen token sayısı azalır.
async function resizeImage(file: File, maxDim = 800, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        quality,
      );
    };
    img.src = url;
  });
}

// ─── Ana sayfa ───────────────────────────────────────────────────────────── //

type Step = "upload" | "analyzing" | "results" | "ai-report";

const AsymmetryAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const doctorId   = Number(userId ?? 1);

  const [patientId,      setPatientId]      = useState<number>(0);
  const [patientAge,     setPatientAge]     = useState<number>(0);
  const [beforeFile,     setBeforeFile]     = useState<File | null>(null);
  const [beforePreview,  setBeforePreview]  = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileB64,     setProfileB64]     = useState<string | null>(null);

  const [step,           setStep]           = useState<Step>("upload");
  const [result,         setResult]         = useState<AsymmetryResult | null>(null);
  const [plan,           setPlan]           = useState<TreatmentPlanResponse | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [aiNotes,        setAiNotes]        = useState("");
  const [planTab,        setPlanTab]        = useState<"rapor" | "harita" | "doz">("rapor");

  // ── Before/After karşılaştırma ── //
  const [afterPreview,   setAfterPreview]   = useState<string | null>(null);
  const [afterResult,    setAfterResult]    = useState<AsymmetryResult | null>(null);
  const [isAnalyzingAfter, setIsAnalyzingAfter] = useState(false);

  // ── Seans geçmişi ────────────────────────────────────────────────────── //
  const [isHistoryOpen,     setIsHistoryOpen]     = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [sessionCount,      setSessionCount]      = useState(0);
  const [savedToast,        setSavedToast]        = useState(false);
  const [lastSavedId,       setLastSavedId]       = useState<string | null>(null);
  const [lastSavedLabel,    setLastSavedLabel]    = useState<string>("");
  const [showQrModal,       setShowQrModal]       = useState(false);
  // Aynı analizi iki kez kaydetmemek için ref
  const savedKeyRef = useRef<string | null>(null);

  // ── Seans sayısı yükle ───────────────────────────────────────────────── //
  useEffect(() => {
    const pid = patientId || result?.patient_id || 0;
    if (pid > 0) {
      sessionsForPatient(pid).then(ss => setSessionCount(ss.length));
    }
  }, [patientId, result?.patient_id, historyRefreshKey]);

  // ── Analiz + plan tamamlandığında otomatik kaydet ─────────────────────── //
  useEffect(() => {
    if (!result || !plan) return;
    const key = `${result.analysis_id}-${plan.plan_id}`;
    if (savedKeyRef.current === key) return;
    savedKeyRef.current = key;

    (async () => {
      try {
        const pid      = result.patient_id;
        const existing = await sessionsForPatient(pid);
        const n        = existing.length;

        // beforePreview bir blob URL olabilir → kalıcı base64'e çevir
        const beforeB64 = beforePreview
          ? await blobUrlToDataUrl(beforePreview)
          : "";

        // Profil benzer şekilde
        const profileB64Stored = profilePreview
          ? await blobUrlToDataUrl(profilePreview, 320)
          : null;

        const thumbnail = await createThumbnail(beforeB64 || "");

        const newSessionId = crypto.randomUUID();
        const newLabel = `Seans ${n + 1}`;
        const session: AnalysisSession = {
          id:                 newSessionId,
          createdAt:          Date.now(),
          label:              newLabel,
          patientId:          pid,
          symmetryScore:      result.symmetry_score,
          thumbnailB64:       thumbnail,
          eyebrowDeltaMm:     result.eyebrow_delta_mm,
          lipDeltaMm:         result.lip_delta_mm,
          midlineDeviationMm: result.midline_deviation_mm,
          result,
          plan,
          beforePreviewB64:   beforeB64,
          profilePreviewB64:  profileB64Stored,
        };

        await sessionSave(session);
        setHistoryRefreshKey(k => k + 1);
        setLastSavedId(newSessionId);
        setLastSavedLabel(newLabel);

        // Toast göster
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
      } catch (err) {
        console.warn("[sessionSave] failed:", err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.analysis_id, plan?.plan_id]);

  // ── Geçmişten seans yükle ────────────────────────────────────────────── //
  const handleLoadSession = useCallback((session: AnalysisSession) => {
    // Bu yüklenen seans yeniden kaydedilmesin
    savedKeyRef.current = `${session.result.analysis_id}-${session.plan?.plan_id ?? "null"}`;

    setResult(session.result);
    setPlan(session.plan);
    setBeforePreview(session.beforePreviewB64 || null);
    setProfilePreview(session.profilePreviewB64 || null);
    setStep("results");
    setAfterPreview(null);
    setAfterResult(null);
    // Yüklenen seans için QR paylaşım butonunu aktif et
    setLastSavedId(session.id);
    setLastSavedLabel(session.label);

    if (session.plan?.treatment_map_b64) setPlanTab("harita");
    else setPlanTab("rapor");
  }, []);

  // ── Fotoğraf seçme ──────────────────────────────────────────────────── //
  const handleBeforeFile = (file: File) => {
    setBeforeFile(file);
    setBeforePreview(URL.createObjectURL(file));
    setResult(null);
    setPlan(null);
    setPlanTab("rapor");
    setAfterPreview(null);
    setAfterResult(null);
  };

  const handleProfileFile = (file: File) => {
    setProfilePreview(URL.createObjectURL(file));
    // Profil fotoğrafı base64 olarak oku (AI'ya gönderilecek)
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // "data:image/jpeg;base64,..." → sadece base64 kısmı
      setProfileB64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
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
      const fileToUpload = await resizeImage(beforeFile);
      const photo    = await uploadPhoto(fileToUpload, patientId, doctorId, "before");
      const analysis = await analyzeAsymmetry(photo.photo_id, patientId);
      setResult(analysis);
      setStep("results");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? (detail as { msg?: string }[]).map(e => e.msg ?? JSON.stringify(e)).join(" | ")
          : "Analiz sırasında hata oluştu.";
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
        analysisId:         result.analysis_id,
        photoId:            result.photo_id,
        patientId:          result.patient_id,
        patientAge:         patientAge > 0 ? patientAge : undefined,
        doctorNotes:        aiNotes || undefined,
        annotatedImageB64:  result.annotated_image_b64,
        profileImageB64:    profileB64 || undefined,
        metrics: {
          symmetry_score:       result.symmetry_score,
          brow_height_diff_mm:  result.eyebrow_delta_mm,
          eye_width_diff_mm:    result.eye_delta_mm,
          mouth_corner_diff_mm: result.lip_delta_mm,
          midline_angle_deg:    result.midline_deviation_mm,
          pitch_deg:            result.pitch_deg ?? 0,
          yaw_deg:              result.yaw_deg   ?? 0,
          roll_deg:             result.roll_deg  ?? 0,
          ...(result.golden_ratio  ? { golden_ratio:  result.golden_ratio  } : {}),
          ...(result.canthal_tilt  ? { canthal_tilt:  result.canthal_tilt  } : {}),
          ...(result.face_shape    ? { face_shape:    result.face_shape    } : {}),
          ...(result.volume_map    ? { volume_map:    result.volume_map    } : {}),
          ...(result.wrinkle_map   ? { wrinkle_map:   result.wrinkle_map   } : {}),
          ...(result.nasal_metrics ? { nasal_metrics: result.nasal_metrics } : {}),
        },
      });
      setPlan(treatmentPlan);
      if (treatmentPlan.treatment_map_b64) {
        setPlanTab("harita");
      }
    } catch (err: unknown) {
      const detail2 = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const msg = typeof detail2 === "string"
        ? detail2
        : Array.isArray(detail2)
          ? (detail2 as { msg?: string }[]).map(e => e.msg ?? JSON.stringify(e)).join(" | ")
          : "AI raporu oluşturulamadı.";
      setError(msg);
      setStep("results");
    }
  };

  // ── After foto analizi ──────────────────────────────────────────────── //
  const runAfterAnalysis = async (file: File) => {
    if (patientId <= 0) return;
    setIsAnalyzingAfter(true);
    try {
      const resized  = await resizeImage(file);
      const photo    = await uploadPhoto(resized, patientId, doctorId, "after");
      const analysis = await analyzeAsymmetry(photo.photo_id, patientId);
      setAfterResult(analysis);
    } catch {
      // sessizce geç
    } finally {
      setIsAnalyzingAfter(false);
    }
  };

  const handleAfterFile = (file: File) => {
    setAfterPreview(URL.createObjectURL(file));
    runAfterAnalysis(file);
  };

  // ── Sıfırla ──────────────────────────────────────────────────────────── //
  const reset = () => {
    setStep("upload"); setResult(null); setPlan(null); setError(null);
    savedKeyRef.current = null;
    setBeforeFile(null); setBeforePreview(null);
    setProfilePreview(null); setProfileB64(null);
    setAfterPreview(null); setAfterResult(null);
    setPlanTab("rapor");
  };

  // ─────────────────────────────────────────────────────────────────────── //
  //  Render                                                                  //
  // ─────────────────────────────────────────────────────────────────────── //
  return (
    <DoctorLayout
      title="AI Yüz Asimetri Analizi"
      action={
        <div className="flex items-center gap-2">
          {/* Geçmiş butonu — her zaman görünür */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="relative text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: isHistoryOpen ? "rgba(99,102,241,0.2)" : "rgba(31,41,55,0.8)",
              border: "1px solid rgba(75,85,99,0.5)",
              color: "#9ca3af",
            }}
          >
            <span>📋</span>
            <span className="hidden sm:inline">Geçmiş</span>
            {sessionCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#6366f1", color: "#fff" }}
              >
                {sessionCount > 9 ? "9+" : sessionCount}
              </span>
            )}
          </button>

          {/* Yeni Analiz */}
          {/* QR Paylaş butonu — seans kaydedildikten sonra görünür */}
          {lastSavedId && (
            <button
              onClick={() => setShowQrModal(true)}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(52,211,153,0.3)",
                color: "#6ee7b7",
              }}
            >
              <span>📲</span>
              <span className="hidden sm:inline">QR Paylaş</span>
            </button>
          )}

          {/* PDF Rapor İndir butonu — analiz sonuçları göründüğünde */}
          {(result || plan) && (
            <button
              onClick={() => {
                if (!result) return;
                exportReportAsPdf(
                  {
                    label: lastSavedLabel || "AI Analiz Seansı",
                    patientId,
                    symmetryScore: result.symmetry_score,
                    createdAt: Date.now(),
                    result,
                  },
                  plan,
                );
              }}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(129,140,248,0.3)",
                color: "#a5b4fc",
              }}
            >
              <span>📄</span>
              <span className="hidden sm:inline">PDF Rapor İndir</span>
            </button>
          )}

          {(result || plan) && (
            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
            >
              ↺ Yeni Analiz
            </button>
          )}
        </div>
      }
    >
    <div className="text-gray-100 relative">

      {/* ── Kayıt toast ── */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium pointer-events-none transition-all duration-300"
        style={{
          background:  "rgba(16,185,129,0.15)",
          border:      "1px solid rgba(52,211,153,0.4)",
          color:       "#6ee7b7",
          boxShadow:   "0 8px 24px rgba(0,0,0,0.4)",
          opacity:     savedToast ? 1 : 0,
          transform:   savedToast
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(12px)",
        }}
      >
        <span>💾</span> Seans kaydedildi
      </div>

      {/* ── Hata mesajı ── */}
      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm flex items-start gap-2">
          <span className="flex-shrink-0">⚠️</span>
          <span>{String(error)}</span>
        </div>
      )}

      {/* ── Baş Pozu Uyarısı ── */}
      {result?.pose_warnings && result.pose_warnings.length > 0 && (
        <div className="mb-4 bg-amber-900/30 border border-amber-600 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="text-amber-300 font-medium text-sm mb-2">Baş Pozu Uyarısı — Ölçümler etkilenmiş olabilir</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {result.pose_warnings.map((w, i) => (
                <span key={i} className="text-xs bg-amber-800/40 border border-amber-600 text-amber-200 px-3 py-1 rounded-full">
                  {w}
                </span>
              ))}
            </div>
            {result.pitch_deg !== null && (
              <p className="text-amber-600 text-xs font-mono">
                Pitch {result.pitch_deg?.toFixed(1)}°&nbsp;|&nbsp;
                Yaw {result.yaw_deg?.toFixed(1)}°&nbsp;|&nbsp;
                Roll {result.roll_deg?.toFixed(1)}°
              </p>
            )}
            <p className="text-amber-500/80 text-xs mt-1">
              Hastadan kameraya düz bakarak yeni fotoğraf çekmesini isteyin.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  ADIM 1: Fotoğraf yükleme                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {(step === "upload" || step === "analyzing") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Frontal fotoğraf */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
              📸 Frontal (Zorunlu)
            </p>
            <PhotoDropzone
              label="Önden Fotoğraf"
              preview={beforePreview}
              onFile={handleBeforeFile}
              loading={step === "analyzing"}
              disabled={step === "analyzing"}
            />
          </div>

          {/* Profil / Lateral fotoğraf */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
              📐 Profil / Lateral <span className="text-gray-700 normal-case">(İsteğe Bağlı)</span>
            </p>
            <PhotoDropzone
              label="Yandan Fotoğraf"
              preview={profilePreview}
              onFile={handleProfileFile}
              disabled={step === "analyzing"}
            />
            {profilePreview && (
              <p className="text-[10px] text-emerald-500 mt-1.5 flex items-center gap-1">
                ✓ Profil görsel AI'ya da gönderilecek
              </p>
            )}
          </div>

          {/* Sağ panel — ayarlar */}
          <div className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-200">Analiz Ayarları</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Hasta ID</label>
                  <input
                    type="number"
                    min={1}
                    value={patientId || ""}
                    onChange={(e) => setPatientId(Number(e.target.value))}
                    placeholder="Örn: 42"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Yaş <span className="text-gray-600">(opsiyonel)</span>
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={patientAge || ""}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    placeholder="Örn: 34"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-3.5 text-xs text-gray-400 space-y-2 border border-gray-700/50">
                <p className="font-medium text-gray-300">📌 Nasıl çalışır?</p>
                <div className="space-y-1.5">
                  <p className="flex items-start gap-2"><span className="text-indigo-400 font-mono">1.</span> Frontal + isteğe bağlı profil fotoğraf yükle</p>
                  <p className="flex items-start gap-2"><span className="text-indigo-400 font-mono">2.</span> MediaPipe 478 yüz noktasını tespit eder</p>
                  <p className="flex items-start gap-2"><span className="text-indigo-400 font-mono">3.</span> 6 estetik metrik + asimetri ölçülür</p>
                  <p className="flex items-start gap-2"><span className="text-indigo-400 font-mono">4.</span> AI görsel + veri ile yaşa uygun rapor üretir</p>
                </div>
              </div>
            </div>

            <button
              onClick={runAnalysis}
              disabled={!beforeFile || patientId <= 0 || step === "analyzing"}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-all text-sm"
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

          {/* ── Fotoğraflar: Frontal (sol) + AI Annotasyon (sağ) — eşit büyüklükte ── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Orijinal frontal */}
            {beforePreview && (
              <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 flex flex-col">
                <div className="px-3 py-2 bg-gray-800/60 text-xs text-gray-400 font-medium flex items-center gap-2 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  Frontal
                  {profilePreview && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] text-teal-400">
                      <img src={profilePreview} alt="Profil" className="w-5 h-5 rounded object-cover border border-teal-700" />
                      Profil ✓
                    </span>
                  )}
                </div>
                <img src={beforePreview} alt="Frontal" className="w-full object-cover flex-1" style={{ height: 360 }} />
              </div>
            )}

            {/* Annotated — asimetri */}
            {result.annotated_image_b64 && (
              <div className="rounded-2xl overflow-hidden border border-indigo-800/50 bg-gray-950 flex flex-col">
                <div className="px-3 py-2 bg-indigo-900/40 flex items-center gap-2 text-xs text-indigo-300 font-medium flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  AI Asimetri Analizi
                </div>
                <div className="flex-1 flex items-center justify-center" style={{ height: 360 }}>
                  <AnnotatedImageWithPins
                    src={`data:image/jpeg;base64,${result.annotated_image_b64}`}
                    alt="Asimetri Analizi"
                    pins={undefined}
                    showPins={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Before / After Karşılaştırma ── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

            {!afterResult ? (
              /* Kompakt bant — fotoğraf yüklenmeden önce */
              <label className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group hover:bg-gray-800/40 transition-colors">
                <span className="text-lg">⚖️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    Tedavi sonrası karşılaştırma ekle
                  </p>
                  <p className="text-xs text-gray-600">After fotoğrafı yükle — delta analizi otomatik yapılır</p>
                </div>
                {isAnalyzingAfter ? (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-900/30 border border-indigo-700/50 px-3 py-1.5 rounded-lg flex-shrink-0">
                    <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    Analiz ediliyor…
                  </span>
                ) : afterPreview ? (
                  <img src={afterPreview} alt="After preview" className="w-10 h-10 rounded-lg object-cover border border-gray-600 flex-shrink-0" />
                ) : (
                  <span className="text-xs bg-gray-800 group-hover:bg-gray-700 border border-gray-700 text-gray-400 group-hover:text-gray-200 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors flex items-center gap-1.5">
                    📷 Fotoğraf seç
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isAnalyzingAfter}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAfterFile(f); }}
                />
              </label>
            ) : (
              <div>
              <div className="px-5 py-3.5 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-gray-200 text-sm flex items-center gap-2">⚖️ Öncesi / Sonrası Karşılaştırma</h3>
                <span className="text-xs bg-emerald-900/40 border border-emerald-700 text-emerald-300 px-3 py-1 rounded-full">✓ Hazır</span>
              </div>
              <div className="p-4">
                {/* ── Drag Slider ── */}
                {beforePreview && afterPreview && (
                  <div className="mb-4">
                    <BeforeAfterSlider
                      beforeSrc={beforePreview}
                      afterSrc={afterPreview}
                      beforeLabel="Öncesi"
                      afterLabel="Sonrası"
                      height={280}
                    />
                  </div>
                )}

                {/* Delta metrikleri */}
                <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Δ Metrik Değişimleri</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "Simetri Skoru", before: result.symmetry_score, after: afterResult.symmetry_score, unit: "/100", higherBetter: true },
                      { label: "Kaş Farkı", before: Math.abs(result.eyebrow_delta_mm), after: Math.abs(afterResult.eyebrow_delta_mm), unit: "mm", higherBetter: false },
                      { label: "Göz Farkı", before: Math.abs(result.eye_delta_mm), after: Math.abs(afterResult.eye_delta_mm), unit: "mm", higherBetter: false },
                      { label: "Dudak Farkı", before: Math.abs(result.lip_delta_mm), after: Math.abs(afterResult.lip_delta_mm), unit: "mm", higherBetter: false },
                    ].map((m, i) => {
                      const delta = m.after - m.before;
                      const improved = m.higherBetter ? delta > 0 : delta < 0;
                      const neutral  = Math.abs(delta) < 0.1;
                      const col = neutral ? "text-gray-400" : improved ? "text-emerald-400" : "text-red-400";
                      const arrow = neutral ? "→" : improved ? "↑" : "↓";
                      return (
                        <div key={i} className="bg-gray-900/60 rounded-lg px-3 py-2.5 border border-gray-700/30">
                          <p className="text-[10px] text-gray-500 mb-1">{m.label}</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-gray-400 font-mono">{m.before.toFixed(1)}</span>
                            <span className={`text-sm font-bold ${col}`}>{arrow}</span>
                            <span className="text-sm font-mono font-semibold text-gray-100">{m.after.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-600">{m.unit}</span>
                          </div>
                          <p className={`text-[10px] font-medium mt-0.5 ${col}`}>
                            {neutral ? "Değişim yok" : `${improved ? "İyileşme" : "Gerileme"} ${Math.abs(delta).toFixed(1)}${m.unit}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* ── Estetik Metrikler (altın oran, canthal, şekil…) ── */}
          <AestheticMetricsPanel result={result} />

          {/* ── Metrikler + AI Üret (plan yokken) ── */}
          {!plan && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Asimetri Ölçümleri (AI raporu henüz yok — bulgusuz göster) */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h2 className="font-semibold text-gray-200 mb-4">Asimetri Ölçümleri</h2>
                <CombinedMetricsFindingsPanel result={result} findings={[]} />
              </div>

              {/* AI Rapor üretme formu */}
              {step === "results" && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-200 mb-2">AI Klinik Rapor</h2>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                      AI, ölçüm verilerini analiz ederek doktorunuz için profesyonel
                      bir klinik rapor ve tedavi önerileri oluşturur.
                    </p>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">
                        Doktor Notu <span className="text-gray-600">(opsiyonel)</span>
                      </label>
                      <textarea
                        rows={5}
                        value={aiNotes}
                        onChange={(e) => setAiNotes(e.target.value)}
                        placeholder="Özel notlar, hasta şikayetleri, kontraendikasyonlar…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={runAIReport}
                    className="mt-4 w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all"
                  >
                    ✨ AI Raporu Oluştur
                  </button>
                </div>
              )}

              {/* AI Raporu yükleniyor */}
              {step === "ai-report" && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-violet-800/40 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm text-center">
                    AI klinik raporu hazırlıyor…
                    <br />
                    <span className="text-gray-600 text-xs">Bu işlem ~10–20 saniye sürebilir</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/*  AI Klinik Raporu — Metrikler ile entegre                       */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {plan && (
            <div className="bg-gray-900 rounded-2xl border border-violet-800/40 overflow-hidden">

              {/* Başlık */}
              <div className="px-6 py-4 bg-violet-900/30 flex items-center justify-between border-b border-violet-800/30">
                <div>
                  <h2 className="font-semibold text-violet-200 flex items-center gap-2 text-base">
                    ✨ AI Klinik Tedavi Raporu
                  </h2>
                  <p className="text-xs text-violet-400/70 mt-0.5">
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

              {/* ── Tab bar: Rapor / Tedavi Haritası / Doz Hesap ── */}
              <div className="flex border-b border-violet-800/30">
                <button
                  onClick={() => setPlanTab("rapor")}
                  className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    planTab === "rapor"
                      ? "border-violet-500 text-violet-300"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  📋 Rapor
                </button>
                {plan.treatment_map_b64 && (
                  <button
                    onClick={() => setPlanTab("harita")}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      planTab === "harita"
                        ? "border-amber-500 text-amber-300"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    🗺️ Tedavi Haritası
                    <span className="ml-1.5 text-[10px] bg-amber-900/50 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
                      {plan.recommendations.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setPlanTab("doz")}
                  className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    planTab === "doz"
                      ? "border-amber-400 text-amber-300"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  💉 Doz Hesap
                  <span className="ml-1.5 text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
                    YENİ
                  </span>
                </button>
              </div>

              {/* ── Tedavi Haritası tab içeriği — split layout ── */}
              {planTab === "harita" && plan.treatment_map_b64 && (
                <div className="p-4">
                  <TreatmentMapSplitLayout
                    mapSrc={`data:image/jpeg;base64,${plan.treatment_map_b64}`}
                    pins={(plan.treatment_pins as TreatmentPin[]) ?? []}
                    recommendations={plan.recommendations}
                  />
                </div>
              )}

              {/* ── Rapor tab içeriği ── */}
              {(planTab === "rapor" || !plan.treatment_map_b64) && (
              <div className="p-6 space-y-6">

                {/* Genel Klinik Değerlendirme — tam genişlik */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Genel Klinik Değerlendirme
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/60 rounded-xl p-4">
                    {plan.clinical_summary}
                  </p>
                </div>

                {/* 2 Sütun: Ölçümler+Bulgular (birleşik) | Tedavi Önerileri */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* ── Birleşik: Asimetri Ölçümleri + Bölgesel Bulgular ── */}
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Ölçümler &amp; Bulgular
                    </h3>
                    <CombinedMetricsFindingsPanel
                      result={result}
                      findings={plan.regional_findings}
                    />
                  </div>

                  {/* ── Tedavi Önerileri ── */}
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Tedavi Önerileri
                    </h3>
                    <div className="space-y-2.5">
                      {plan.recommendations.length === 0 ? (
                        <p className="text-xs text-gray-600 italic">Tedavi önerisi bulunmuyor.</p>
                      ) : (
                        plan.recommendations.map((r, i) => (
                          <div key={i} className="bg-gray-900/60 rounded-lg px-3 py-2.5 border border-gray-700/30">
                            {/* Tedavi adı + ünite */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <PriorityDot priority={r.priority} />
                              <span className="text-xs font-semibold text-gray-200 leading-tight">{r.treatment}</span>
                              {r.estimated_units && (
                                <span className="ml-auto text-[10px] text-amber-400 font-mono bg-amber-900/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {r.estimated_units}
                                </span>
                              )}
                            </div>
                            {/* Kas adı */}
                            {r.target_muscle && (
                              <div className="ml-4 mb-1">
                                <span className="text-[10px] text-indigo-400 bg-indigo-900/30 border border-indigo-700/40 px-1.5 py-0.5 rounded font-mono">
                                  🎯 {r.target_muscle}
                                </span>
                              </div>
                            )}
                            {/* Bölge */}
                            <div className="ml-4 mb-1">
                              <span className="text-[10px] text-gray-500">📍 {r.region}</span>
                            </div>
                            {/* Klinik not */}
                            <p className="text-[11px] text-gray-400 ml-4 leading-relaxed">{r.notes}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Alt bilgiler: Hasta iletişimi + Kontraendikasyon + Takip ── */}
                <div className="space-y-3">
                  {plan.patient_communication && (
                    <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                        💬 Hasta ile Paylaşılabilecek Özet
                      </h3>
                      <p className="text-sm text-emerald-200/70 leading-relaxed">
                        {plan.patient_communication}
                      </p>
                    </div>
                  )}

                  {plan.contraindications && (
                    <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">
                        ⚠️ Kontraendikasyonlar
                      </h3>
                      <p className="text-sm text-red-200/70">{plan.contraindications}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-gray-400">
                      📅 Önerilen takip aralığı:
                    </span>
                    <span className="text-sm text-white font-medium">
                      {plan.follow_up_interval_weeks} hafta
                    </span>
                  </div>

                  {/* ── Faturaya Ekle ── */}
                  <div className="pt-2 border-t border-gray-700/40 flex justify-end">
                    <button
                      onClick={() => navigate('/doctor/invoices', {
                        state: {
                          fromAI:    true,
                          patientId: String(result?.patient_id ?? ''),
                          planNote:  plan.recommendations.map(r => `${r.treatment} (${r.region})`).join(' | '),
                        }
                      })}
                      className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                      🧾 Tedavi Planını Faturaya Ekle
                    </button>
                  </div>
                </div>

              </div>
              )} {/* end planTab === "rapor" */}

              {/* ── Doz Hesaplama tab içeriği ── */}
              {planTab === "doz" && (
                <BotoxDoseCalculator
                  recommendations={plan.recommendations}
                  asymmetryDelta={result ? {
                    eyebrow: result.eyebrow_delta_mm,
                    lip:     result.lip_delta_mm,
                    midline: result.midline_deviation_mm,
                  } : undefined}
                />
              )}

            </div>
          )}
        </div>
      )}
    </div>

    {/* ── Seans Geçmişi Drawer ─────────────────────────────────────────── */}
    <SessionHistoryDrawer
      patientId={patientId || result?.patient_id || 0}
      isOpen={isHistoryOpen}
      onClose={() => setIsHistoryOpen(false)}
      onLoad={handleLoadSession}
      refreshKey={historyRefreshKey}
    />

    {/* ── QR Paylaşım Modalı ────────────────────────────────────────────── */}
    {showQrModal && lastSavedId && (
      <ShareQrModal
        sessionId={lastSavedId}
        sessionLabel={lastSavedLabel}
        onClose={() => setShowQrModal(false)}
      />
    )}

    </DoctorLayout>
  );
};

export default AsymmetryAnalysisPage;
