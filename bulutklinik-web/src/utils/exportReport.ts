import type { AsymmetryResult, TreatmentPlanResponse } from '../services/asymmetryApi'

const DISCLAIMER_TEXT =
  'Bu sistem tarafından üretilen AI analiz raporları, lisanslı bir hekimin değerlendirmesinin yerini alamaz. ' +
  'Raporlar yalnızca klinik karar desteği amacıyla üretilmekte olup kesin tanı veya tedavi önerisi niteliği taşımamaktadır. ' +
  'Hastanın bireysel anatomisi, tıbbi öyküsü ve hekim muayenesi her zaman önceliklidir. ' +
  'Medica.AI ve yazılım geliştiricileri, AI raporlarının klinik uygulamaya yansımasından doğabilecek sonuçlardan sorumlu tutulamaz.'

interface ReportSession {
  label:         string
  patientId:     number
  symmetryScore: number
  createdAt:     number
  result:        AsymmetryResult
  beforePreviewB64?: string
}

function scoreHex(score: number): string {
  if (score >= 80) return '#059669'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function priorityLabel(p: string): string {
  if (p === 'high')   return 'Yüksek'
  if (p === 'medium') return 'Orta'
  return 'Düşük'
}

function priorityColor(p: string): string {
  if (p === 'high')   return '#dc2626'
  if (p === 'medium') return '#d97706'
  return '#059669'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function gaugeArc(score: number): string {
  // SVG arc for semicircle gauge: 0–100 maps to 0–180deg
  const r   = 70
  const cx  = 90
  const cy  = 90
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const ang = pct * Math.PI  // 0 – π (left to right)
  const x   = cx + r * Math.cos(Math.PI - ang)
  const y   = cy - r * Math.sin(ang)
  // large-arc: 1 if > 180deg
  const large = pct > 0.5 ? 1 : 0
  return `M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`
}

export function exportReportAsPdf(
  session: ReportSession,
  plan: TreatmentPlanResponse | null,
): void {
  const result  = session.result
  const score   = session.symmetryScore
  const color   = scoreHex(score)
  const dateStr = formatDate(session.createdAt)

  // ── Metrik tablosu satırları ──
  const metrics: { name: string; value: string; ok: boolean }[] = [
    { name: 'Simetri Skoru',         value: `${score}`,                       ok: score >= 70 },
    { name: 'Kaş Asimetrisi',        value: `${result.eyebrow_delta_mm.toFixed(2)} mm`,  ok: result.eyebrow_delta_mm < 2 },
    { name: 'Göz Farkı',             value: `${result.eye_delta_mm.toFixed(2)} mm`,      ok: result.eye_delta_mm < 1.5 },
    { name: 'Dudak Asimetrisi',      value: `${result.lip_delta_mm.toFixed(2)} mm`,      ok: result.lip_delta_mm < 1.5 },
    { name: 'Burun Sapması',         value: `${result.nose_deviation_mm.toFixed(2)} mm`, ok: result.nose_deviation_mm < 2 },
    { name: 'Orta Hat Sapması',      value: `${result.midline_deviation_mm.toFixed(2)} mm`, ok: result.midline_deviation_mm < 2 },
  ]

  const metricRows = metrics.map(m => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:13px;">${m.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;color:#111827;">${m.value}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">
        <span style="color:${m.ok ? '#059669' : '#d97706'};font-weight:700;">${m.ok ? '✓' : '⚠'}</span>
      </td>
    </tr>`).join('')

  // ── Tedavi planı satırları ──
  const recRows = plan
    ? plan.recommendations.map((rec, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${i + 1}. ${rec.treatment}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${rec.region}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">
          <span style="color:${priorityColor(rec.priority)};font-weight:700;">${priorityLabel(rec.priority)}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;">${rec.notes ?? '—'}</td>
      </tr>`).join('')
    : ''

  // ── SVG Gauge ──
  const arcPath = gaugeArc(score)
  const gauge = `
    <svg width="180" height="100" viewBox="0 0 180 100" xmlns="http://www.w3.org/2000/svg">
      <!-- track -->
      <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#e5e7eb" stroke-width="14" stroke-linecap="round"/>
      <!-- fill -->
      <path d="${arcPath}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
      <!-- score text -->
      <text x="90" y="85" text-anchor="middle" font-size="26" font-weight="700" fill="${color}" font-family="system-ui">${score}</text>
      <text x="90" y="100" text-anchor="middle" font-size="10" fill="#9ca3af" font-family="system-ui">Simetri Skoru</text>
    </svg>`

  // ── Tedavi haritası ──
  const mapSection = (plan?.treatment_map_b64)
    ? `<section style="margin-bottom:28px;">
        <h2 style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-bottom:16px;">Tedavi Haritası</h2>
        <img src="data:image/png;base64,${plan.treatment_map_b64}" alt="Tedavi Haritası"
             style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb;display:block;"/>
      </section>`
    : ''

  // ── Klinik özet ──
  const summarySection = plan?.clinical_summary
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:13px;color:#065f46;line-height:1.6;margin:0;">${plan.clinical_summary}</p>
      </div>`
    : ''

  // ── Plan bölümü ──
  const planSection = plan ? `
    <section style="margin-bottom:28px;">
      <h2 style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-bottom:14px;">AI Tedavi Planı</h2>
      ${summarySection}
      ${recRows ? `
      <table style="width:100%;border-collapse:collapse;font-family:system-ui;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Tedavi</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Bölge</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Öncelik</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Notlar</th>
          </tr>
        </thead>
        <tbody>${recRows}</tbody>
      </table>` : '<p style="color:#9ca3af;font-size:13px;">Tedavi önerisi bulunamadı.</p>'}
    </section>` : ''

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Medica.AI — AI Analiz Raporu</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;color:#111827;background:#fff;padding:0}
    @page{size:A4;margin:20mm}
    @media print{
      .no-print{display:none!important}
      body{padding:0}
      section{page-break-inside:avoid}
    }
  </style>
</head>
<body>
  <!-- Print button -->
  <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:100;">
    <button onclick="window.print()"
      style="background:#0d9488;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
      Yazdır / PDF Kaydet
    </button>
  </div>

  <div style="max-width:800px;margin:0 auto;padding:32px 40px;">

    <!-- Header -->
    <header style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #0d9488;">
      <div>
        <h1 style="font-size:22px;font-weight:800;color:#0d9488;letter-spacing:-0.5px;">Medica.AI</h1>
        <p style="font-size:12px;color:#6b7280;margin-top:2px;">Estetik Klinik Yönetim Platformu</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:6px;">AI Asimetri Analiz Raporu</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:12px;color:#6b7280;">Rapor Tarihi</p>
        <p style="font-size:13px;font-weight:600;color:#111827;">${dateStr}</p>
      </div>
    </header>

    <!-- Seans bilgileri -->
    <section style="margin-bottom:28px;">
      <h2 style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-bottom:14px;">Seans Bilgileri</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#f9fafb;border-radius:10px;padding:12px 16px;border:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Seans Adı</p>
          <p style="font-size:14px;font-weight:600;color:#111827;">${session.label || 'İsimsiz Seans'}</p>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:12px 16px;border:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Hasta ID</p>
          <p style="font-size:14px;font-weight:600;color:#111827;">${session.patientId}</p>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:12px 16px;border:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Analiz ID</p>
          <p style="font-size:14px;font-weight:600;color:#111827;">${result.analysis_id}</p>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:12px 16px;border:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Tarih</p>
          <p style="font-size:14px;font-weight:600;color:#111827;">${dateStr}</p>
        </div>
      </div>
    </section>

    <!-- Simetri Skoru (Gauge) -->
    <section style="margin-bottom:28px;">
      <h2 style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-bottom:16px;">Simetri Skoru</h2>
      <div style="display:flex;align-items:center;gap:32px;">
        ${gauge}
        <div>
          <p style="font-size:32px;font-weight:800;color:${color};">${score}<span style="font-size:18px;font-weight:400;color:#9ca3af;">/100</span></p>
          <p style="font-size:13px;color:#6b7280;margin-top:4px;">
            ${score >= 80 ? 'Mükemmel simetri' : score >= 60 ? 'Orta düzey asimetri' : 'Belirgin asimetri'}
          </p>
        </div>
      </div>
    </section>

    <!-- Metrik Tablosu -->
    <section style="margin-bottom:28px;">
      <h2 style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-bottom:14px;">Ölçüm Metrikleri</h2>
      <table style="width:100%;border-collapse:collapse;font-family:system-ui;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Ölçüm</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Değer</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Durum</th>
          </tr>
        </thead>
        <tbody>${metricRows}</tbody>
      </table>
    </section>

    ${planSection}
    ${mapSection}

    <!-- Footer / Disclaimer -->
    <footer style="margin-top:40px;padding-top:20px;border-top:2px solid #fee2e2;background:#fff7f7;border-radius:10px;padding:16px 20px;">
      <p style="font-size:11px;font-weight:700;color:#b91c1c;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Yasal Sorumluluk Reddi</p>
      <p style="font-size:11px;color:#6b7280;line-height:1.7;">${DISCLAIMER_TEXT}</p>
      <p style="font-size:10px;color:#9ca3af;margin-top:10px;">Medica.AI &copy; ${new Date().getFullYear()} — Tüm hakları saklıdır.</p>
    </footer>

  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
