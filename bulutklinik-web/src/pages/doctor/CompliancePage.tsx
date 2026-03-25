/**
 * Uyumluluk & Rıza Merkezi
 * ─────────────────────────
 * #3 Medikal Sorumluluk Disclaimer
 * #2 Hasta Açık Rıza Formu (KVKK + Tıbbi)
 * #1 KVKK / GDPR Uyumu
 *
 * Veriler localStorage'da saklanır.
 * Yasal uyumluluk için imzalanmış formlar PDF benzeri print görünümüyle sunulur.
 */

import { useState, useEffect } from 'react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  Shield, FileText, CheckCircle2, AlertTriangle,
  Plus, Search, User, Calendar, Eye, Printer, ChevronDown,
  ChevronUp, Lock, X,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConsentRecord {
  id:            string
  patientId:     number
  patientName:   string
  patientPhone:  string
  treatmentType: string
  signedAt:      number          // Date.now()
  ipAddress:     string          // symbolic
  consentText:   string
  kvkkAccepted:  boolean
  medicalAccepted: boolean
  disclaimerRead:  boolean
  doctorName:    string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bk_consent_records'

const TREATMENTS = [
  'Botulinum Toksin (Botoks)',
  'Hyaluronik Asit Dolgu',
  'PRP (Trombosit Zengini Plazma)',
  'Lazer Uygulaması',
  'Mezoterapi',
  'Kimyasal Peeling',
  'İplik Asma (Thread Lift)',
  'Diğer Estetik Prosedür',
]

const KVKK_TEXT = `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, klinik hizmetleri sunabilmek amacıyla kişisel verileriniz (kimlik, iletişim, sağlık bilgileri ve biyometrik görüntüleriniz) işlenecektir. Verileriniz yalnızca tedavi süreçlerinde ve yasal yükümlülükler çerçevesinde kullanılacak; üçüncü kişilerle yalnızca açık rızanız veya yasal zorunluluk halinde paylaşılacaktır. KVKK'nın 11. maddesi kapsamında verilerinize erişim, düzeltme, silme ve itiraz haklarınız saklıdır.`

const MEDICAL_CONSENT_TEXT = (treatment: string) =>
  `${treatment} prosedürünün olası risk ve komplikasyonları (geçici şişlik, morluk, asimetri, enfeksiyon, alerjik reaksiyon vb.) hakkında bilgilendirildim. Alternatifleri değerlendirdim ve bu işlemi kendi özgür iradem ile yaptırmayı kabul ediyorum. İşlem öncesi, esnasında ve sonrasında doktor talimatlarına uyacağımı taahhüt ederim.`

const DISCLAIMER_TEXT = `Bu sistem tarafından üretilen AI analiz raporları, lisanslı bir hekimin değerlendirmesinin yerini alamaz. Raporlar yalnızca klinik karar desteği amacıyla üretilmekte olup kesin tanı veya tedavi önerisi niteliği taşımamaktadır. Hastanın bireysel anatomisi, tıbbi öyküsü ve hekim muayenesi her zaman önceliklidir. Medica.AI ve yazılım geliştiricileri, AI raporlarının klinik uygulamaya yansımasından doğabilecek sonuçlardan sorumlu tutulamaz.`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function load(): ConsentRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function save(r: ConsentRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }
function fmt(ts: number) {
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fakeIp() {
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

// ─── Print/Export ─────────────────────────────────────────────────────────────

function printConsent(r: ConsentRecord) {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(`
    <html><head><title>Rıza Formu — ${r.patientName}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#1f2937;line-height:1.6}
      h1{font-size:20px;border-bottom:2px solid #0f766e;padding-bottom:8px;color:#0f766e}
      h2{font-size:14px;color:#374151;margin-top:24px}
      p{font-size:13px;color:#4b5563}
      .meta{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0}
      .meta span{display:inline-block;margin-right:24px;font-size:12px}
      .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold}
      .ok{background:#d1fae5;color:#065f46}.warn{background:#fef3c7;color:#92400e}
      .sig{margin-top:40px;border-top:1px dashed #9ca3af;padding-top:12px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>🏥 Medica.AI — Hasta Açık Rıza & KVKK Formu</h1>
    <div class="meta">
      <span><b>Hasta:</b> ${r.patientName}</span>
      <span><b>Telefon:</b> ${r.patientPhone}</span>
      <span><b>Hasta ID:</b> ${r.patientId}</span><br/>
      <span><b>Tedavi:</b> ${r.treatmentType}</span>
      <span><b>Tarih:</b> ${fmt(r.signedAt)}</span>
    </div>

    <h2>KVKK Aydınlatma Metni</h2>
    <p>${KVKK_TEXT}</p>
    <p><span class="badge ${r.kvkkAccepted ? 'ok' : 'warn'}">${r.kvkkAccepted ? '✓ Kabul edildi' : '✗ Reddedildi'}</span></p>

    <h2>Tıbbi Rıza Beyanı</h2>
    <p>${MEDICAL_CONSENT_TEXT(r.treatmentType)}</p>
    <p><span class="badge ${r.medicalAccepted ? 'ok' : 'warn'}">${r.medicalAccepted ? '✓ Kabul edildi' : '✗ Reddedildi'}</span></p>

    <h2>AI Sorumluluk Reddi</h2>
    <p>${DISCLAIMER_TEXT}</p>
    <p><span class="badge ${r.disclaimerRead ? 'ok' : 'warn'}">${r.disclaimerRead ? '✓ Okundu ve onaylandı' : '✗ Onaylanmadı'}</span></p>

    <div class="sig">
      <p><b>İmza (dijital kabul):</b> ${r.patientName} — ${fmt(r.signedAt)}</p>
      <p><b>IP Adresi:</b> ${r.ipAddress}</p>
      <p><b>Sorumlu Hekim:</b> ${r.doctorName}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px">
        Bu form Medica.AI sistemi tarafından elektronik olarak oluşturulmuş olup dijital imza değerinde kabul edilir.
        Form ID: ${r.id}
      </p>
    </div>
    <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#0f766e;color:white;border:none;border-radius:6px;cursor:pointer">
      🖨️ Yazdır
    </button>
    </body></html>
  `)
  w.document.close()
  w.focus()
}

// ─── New Consent Form ─────────────────────────────────────────────────────────

interface FormState {
  patientId:     string
  patientName:   string
  patientPhone:  string
  treatmentType: string
  kvkkAccepted:  boolean
  medicalAccepted: boolean
  disclaimerRead:  boolean
}

function blankForm(): FormState {
  return {
    patientId: '', patientName: '', patientPhone: '',
    treatmentType: TREATMENTS[0],
    kvkkAccepted: false, medicalAccepted: false, disclaimerRead: false,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [records, setRecords] = useState<ConsentRecord[]>(load)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm())
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('kvkk')
  const [doctorName] = useState(() => {
    // Basit: localStorage'dan doktor adını al
    try {
      const auth = JSON.parse(localStorage.getItem('auth-storage') ?? '{}')
      return auth?.state?.user?.fullName ?? 'Sorumlu Hekim'
    } catch { return 'Sorumlu Hekim' }
  })

  useEffect(() => { save(records) }, [records])

  const filtered = records.filter(r =>
    r.patientName.toLowerCase().includes(search.toLowerCase()) ||
    String(r.patientId).includes(search) ||
    r.treatmentType.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.signedAt - a.signedAt)

  function submit() {
    if (!form.patientName.trim() || !form.kvkkAccepted || !form.medicalAccepted || !form.disclaimerRead) return
    const rec: ConsentRecord = {
      id:              crypto.randomUUID(),
      patientId:       Number(form.patientId) || 0,
      patientName:     form.patientName.trim(),
      patientPhone:    form.patientPhone.trim(),
      treatmentType:   form.treatmentType,
      signedAt:        Date.now(),
      ipAddress:       fakeIp(),
      consentText:     MEDICAL_CONSENT_TEXT(form.treatmentType),
      kvkkAccepted:    form.kvkkAccepted,
      medicalAccepted: form.medicalAccepted,
      disclaimerRead:  form.disclaimerRead,
      doctorName,
    }
    setRecords(prev => [rec, ...prev])
    setShowForm(false)
    setForm(blankForm())
  }

  function deleteRecord(id: string) {
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const allSigned = form.kvkkAccepted && form.medicalAccepted && form.disclaimerRead
  const canSubmit = form.patientName.trim().length > 0 && allSigned

  const stats = {
    total:   records.length,
    thisMonth: records.filter(r => {
      const d = new Date(r.signedAt)
      const n = new Date()
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
    }).length,
    complete: records.filter(r => r.kvkkAccepted && r.medicalAccepted && r.disclaimerRead).length,
  }

  return (
    <DoctorLayout title="Uyumluluk & Rıza Merkezi" action={
      <button
        onClick={() => { setShowForm(true); setForm(blankForm()) }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
      >
        <Plus size={15} /> Yeni Rıza Formu
      </button>
    }>

      <div className="space-y-5">

        {/* ── Stats banner ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Toplam Kayıtlı Form', value: stats.total, icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Bu Ay İmzalanan', value: stats.thisMonth, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Tam Onaylı', value: stats.complete, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={color} size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Legal info cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* KVKK */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'kvkk' ? null : 'kvkk')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Lock className="text-blue-600" size={16} />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-gray-800">KVKK / GDPR</p>
                <p className="text-xs text-gray-400">Kişisel veri işleme metni</p>
              </div>
              {expandedSection === 'kvkk' ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {expandedSection === 'kvkk' && (
              <div className="px-4 pb-4 text-xs text-gray-500 leading-relaxed border-t border-gray-50">
                <p className="pt-3">{KVKK_TEXT}</p>
              </div>
            )}
          </div>

          {/* Tıbbi Rıza */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'medical' ? null : 'medical')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <FileText className="text-purple-600" size={16} />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-gray-800">Tıbbi Rıza Beyanı</p>
                <p className="text-xs text-gray-400">Hasta onam metni</p>
              </div>
              {expandedSection === 'medical' ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {expandedSection === 'medical' && (
              <div className="px-4 pb-4 text-xs text-gray-500 leading-relaxed border-t border-gray-50">
                <p className="pt-3">{MEDICAL_CONSENT_TEXT('seçili tedavi')}</p>
              </div>
            )}
          </div>

          {/* AI Disclaimer */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'disclaimer' ? null : 'disclaimer')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-amber-600" size={16} />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-gray-800">AI Sorumluluk Reddi</p>
                <p className="text-xs text-gray-400">Medikal disclaimer</p>
              </div>
              {expandedSection === 'disclaimer' ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {expandedSection === 'disclaimer' && (
              <div className="px-4 pb-4 text-xs text-amber-700 leading-relaxed bg-amber-50 border-t border-amber-100">
                <p className="pt-3">{DISCLAIMER_TEXT}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Records list ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <Shield size={16} className="text-teal-600" />
            <span className="font-bold text-gray-800 text-sm">İmzalanan Formlar</span>
            <div className="ml-auto relative max-w-xs w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Hasta ara…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <FileText className="text-gray-300" size={28} />
              </div>
              <p className="text-gray-400 text-sm">
                {search ? 'Arama sonucu bulunamadı' : 'Henüz rıza formu kaydı yok'}
              </p>
              {!search && (
                <button
                  onClick={() => { setShowForm(true); setForm(blankForm()) }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
                >
                  <Plus size={14} /> İlk Formu Oluştur
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(rec => (
                <div key={rec.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <User size={15} className="text-teal-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{rec.patientName}</span>
                        {rec.patientId > 0 && <span className="text-xs text-gray-400">#{rec.patientId}</span>}
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{rec.treatmentType}</span>
                        {(rec.kvkkAccepted && rec.medicalAccepted && rec.disclaimerRead) ? (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={10} /> Tam Onaylı
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle size={10} /> Eksik Onay
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{fmt(rec.signedAt)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Detay"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => printConsent(rec)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Yazdır / İndir"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => deleteRecord(rec.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === rec.id && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-3 py-3">
                        {[
                          { label: 'KVKK', ok: rec.kvkkAccepted },
                          { label: 'Tıbbi Rıza', ok: rec.medicalAccepted },
                          { label: 'AI Disclaimer', ok: rec.disclaimerRead },
                        ].map(({ label, ok }) => (
                          <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {ok ? <CheckCircle2 size={13} /> : <X size={13} />}
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>Telefon: {rec.patientPhone || '—'}</span>
                        <span>IP: {rec.ipAddress}</span>
                        <span>Hekim: {rec.doctorName}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5 font-mono">Form ID: {rec.id}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── New Consent Form Modal ─────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-emerald-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="text-white" size={18} />
                <span className="font-bold text-white">Hasta Rıza & KVKK Formu</span>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Patient info */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Hasta Bilgileri</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Ad Soyad *</label>
                    <input
                      type="text" placeholder="Adı Soyadı"
                      value={form.patientName}
                      onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Telefon</label>
                    <input
                      type="tel" placeholder="05XX XXX XX XX"
                      value={form.patientPhone}
                      onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Hasta ID</label>
                    <input
                      type="number" placeholder="0"
                      value={form.patientId}
                      onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tedavi Türü *</label>
                    <select
                      value={form.treatmentType}
                      onChange={e => setForm(f => ({ ...f, treatmentType: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* KVKK */}
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2.5">
                  <Lock size={13} className="text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">KVKK Aydınlatma Metni</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{KVKK_TEXT}</p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.kvkkAccepted}
                      onChange={e => setForm(f => ({ ...f, kvkkAccepted: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-teal-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      KVKK kapsamında kişisel verilerimin işlenmesine açık rıza veriyorum.
                    </span>
                  </label>
                </div>
              </div>

              {/* Medical consent */}
              <div className="border border-purple-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2.5">
                  <FileText size={13} className="text-purple-600" />
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Tıbbi Rıza Beyanı</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">
                    {MEDICAL_CONSENT_TEXT(form.treatmentType)}
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.medicalAccepted}
                      onChange={e => setForm(f => ({ ...f, medicalAccepted: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-teal-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      Riskler hakkında bilgilendirildim ve bu prosedürü yaptırmayı onaylıyorum.
                    </span>
                  </label>
                </div>
              </div>

              {/* AI Disclaimer */}
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5">
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">AI Sorumluluk Reddi</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">{DISCLAIMER_TEXT}</p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.disclaimerRead}
                      onChange={e => setForm(f => ({ ...f, disclaimerRead: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-teal-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      AI raporlarının klinik karar desteği olduğunu ve hekim muayenesinin yerini almayacağını anlıyorum.
                    </span>
                  </label>
                </div>
              </div>

              {/* Signature info */}
              {allSigned && form.patientName.trim() && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-3 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 size={14} />
                  <span>
                    <b>{form.patientName}</b> formun tüm bölümlerini onayladı.
                    Kaydet butonuna basarak dijital imza oluşturulacaktır.
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 justify-center"
              >
                <CheckCircle2 size={14} /> Kaydet & İmzala
              </button>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  )
}
