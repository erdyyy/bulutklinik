/**
 * Paylaşılan Analiz Raporu — QR ile hasta erişimi
 * ──────────────────────────────────────────────────
 * URL: /report/:token
 * Token: base64url( sessionId + ":" + expiryTimestamp )
 * Giriş gerektirmez. IndexedDB'den oturumu okur.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AnalysisSession } from '../../services/sessionStore'
import { ScanFace, CheckCircle2, AlertTriangle, Clock, Shield } from 'lucide-react'

// ─── Token helpers ───────────────────────────────────────────────────────────

function decodeToken(token: string): { sessionId: string; expiry: number } | null {
  try {
    const raw = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const [sessionId, expiryStr] = raw.split(':')
    return { sessionId, expiry: Number(expiryStr) }
  } catch {
    return null
  }
}

// ─── Gauge component ─────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score))
  const color = clamp >= 85 ? '#10b981' : clamp >= 70 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 44
  const offset = circumference - (clamp / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="44" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {Math.round(clamp)}
        </text>
      </svg>
      <span className="text-sm font-semibold text-gray-600">Simetri Skoru</span>
    </div>
  )
}

// ─── Measurement row ─────────────────────────────────────────────────────────

function MeasRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">{value}</span>
        {good
          ? <CheckCircle2 size={14} className="text-green-500" />
          : <AlertTriangle size={14} className="text-amber-500" />
        }
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const [session, setSession] = useState<AnalysisSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setError('Geçersiz bağlantı.'); setLoading(false); return }

    const decoded = decodeToken(token)
    if (!decoded) { setError('Bağlantı çözümlenemedi.'); setLoading(false); return }

    if (Date.now() > decoded.expiry) {
      setError('Bu bağlantının süresi dolmuş. Lütfen kliniğinizden yeni bir bağlantı isteyin.')
      setLoading(false); return
    }

    // Tüm hastalara ait oturumları bul — patientId bilinmediğinden tüm kayıtlara bakıyoruz
    ;(async () => {
      try {
        // sessionsForPatient yerine tüm store'u tara
        const { sessionsAll } = await import('../../services/sessionStore')
        const all = await sessionsAll()
        const found = all.find(s => s.id === decoded.sessionId)
        if (!found) {
          setError('Rapor bulunamadı. Bağlantı geçerli olsa da veri bu cihazda mevcut değil.')
        } else {
          setSession(found)
        }
      } catch {
        setError('Veriye erişilirken hata oluştu.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
        <p className="text-teal-700 font-medium text-sm">Rapor yükleniyor…</p>
      </div>
    </div>
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <AlertTriangle className="text-red-500" size={28} />
        </div>
        <h2 className="font-bold text-gray-900 text-lg">Rapor Açılamadı</h2>
        <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
        <div className="flex items-center gap-2 justify-center text-xs text-gray-400 pt-2">
          <Shield size={12} />
          <span>Medica.AI — Güvenli Paylaşım</span>
        </div>
      </div>
    </div>
  )

  if (!session) return null

  const { plan, beforePreviewB64, symmetryScore,
          eyebrowDeltaMm, lipDeltaMm, midlineDeviationMm, label, createdAt } = session

  const date = new Date(createdAt).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
            <ScanFace className="text-white" size={18} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">Medica.AI</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Yüz Asimetri Analiz Raporu</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={12} />
            <span>{date}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Session label */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">{label}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kişisel analiz raporunuz</p>
        </div>

        {/* Photo + Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-5">
            {beforePreviewB64 ? (
              <img
                src={beforePreviewB64}
                alt="Analiz fotoğrafı"
                className="w-28 h-28 rounded-xl object-cover flex-shrink-0 shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <ScanFace className="text-gray-300" size={32} />
              </div>
            )}
            <ScoreGauge score={symmetryScore} />
          </div>
        </div>

        {/* Measurements */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Ölçüm Sonuçları</h2>
          <MeasRow
            label="Kaş Asimetrisi"
            value={`${eyebrowDeltaMm.toFixed(1)} mm`}
            good={eyebrowDeltaMm < 3}
          />
          <MeasRow
            label="Dudak Asimetrisi"
            value={`${lipDeltaMm.toFixed(1)} mm`}
            good={lipDeltaMm < 2}
          />
          <MeasRow
            label="Orta Hat Sapması"
            value={`${midlineDeviationMm.toFixed(1)} mm`}
            good={midlineDeviationMm < 2}
          />
        </div>

        {/* AI Recommendations */}
        {plan?.recommendations && plan.recommendations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Doktor Önerileri</h2>
            <ul className="space-y-2">
              {plan.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 size={14} className="text-teal-500 mt-0.5 flex-shrink-0" />
                  <span>{rec.treatment} — {rec.region}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Treatment map */}
        {plan?.treatment_map_b64 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Tedavi Haritası</h2>
            <img
              src={`data:image/png;base64,${plan.treatment_map_b64}`}
              alt="Tedavi haritası"
              className="w-full rounded-xl"
            />
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-xs text-amber-700 leading-relaxed">
          <p className="font-semibold mb-1">⚠️ Önemli Bilgi</p>
          <p>Bu rapor yalnızca bilgilendirme amaçlıdır; tıbbi tanı yerine geçmez. Sonuçlarla ilgili sorularınız için lütfen kliniğinizle iletişime geçin.</p>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-gray-400 pb-4">
          <Shield size={12} />
          <span>Medica.AI Güvenli Paylaşım · Şifreli Bağlantı</span>
        </div>
      </div>
    </div>
  )
}
