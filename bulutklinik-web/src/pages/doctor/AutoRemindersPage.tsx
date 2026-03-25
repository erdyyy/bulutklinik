import { useState, useEffect } from 'react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  Bell, Plus, Trash2, Edit3, X, CheckCircle2,
  MessageSquare, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

// ─── Types ────────────────────────────────────────────────────────────────── //

type Channel = 'WhatsApp' | 'SMS' | 'Email'
type Timing  = 'before' | 'after'
type Unit    = 'hour' | 'day'

interface ReminderRule {
  id:       string
  active:   boolean
  amount:   number
  unit:     Unit
  timing:   Timing
  channels: Channel[]
  template: string
}

interface SendLog {
  id:          string
  patientName: string
  aptDate:     string
  channel:     Channel
  status:      'sent' | 'failed'
  sentAt:      string
}

// ─── Constants ────────────────────────────────────────────────────────────── //

const STORAGE_KEY_RULES = 'bk_reminder_rules'
const STORAGE_KEY_LOGS  = 'bk_reminder_logs'

const MOCK_PATIENT_DATA = {
  hastaAdı:   'Ayşe Kaya',
  saat:       '14:30',
  tarih:      dayjs().format('DD MMMM YYYY'),
  doktorAdı:  'Dr. Ahmet Yılmaz',
  klinikAdı:  'Medica.AI',
  klinikAdres:'Bağcılar Mah. Klinik Cad. No:12, İstanbul',
}

const VARIABLES: { key: string; label: string }[] = [
  { key: '{hastaAdı}',    label: 'Hasta Adı' },
  { key: '{saat}',        label: 'Saat' },
  { key: '{tarih}',       label: 'Tarih' },
  { key: '{doktorAdı}',   label: 'Doktor Adı' },
  { key: '{klinikAdı}',   label: 'Klinik Adı' },
  { key: '{klinikAdres}', label: 'Klinik Adresi' },
]

const DEFAULT_RULES: ReminderRule[] = [
  {
    id: 'rule-1',
    active: true,
    amount: 24,
    unit: 'hour',
    timing: 'before',
    channels: ['WhatsApp', 'SMS'],
    template: 'Sayın {hastaAdı}, yarın saat {saat}\'deki randevunuzu hatırlatırız. Klinik: {klinikAdı}',
  },
  {
    id: 'rule-2',
    active: true,
    amount: 2,
    unit: 'hour',
    timing: 'before',
    channels: ['SMS'],
    template: 'Randevunuz 2 saat sonra. Adres: {klinikAdres}',
  },
  {
    id: 'rule-3',
    active: false,
    amount: 1,
    unit: 'day',
    timing: 'after',
    channels: ['Email'],
    template: 'Sayın {hastaAdı}, nasılsınız? Sonraki kontrolünüz için {klinikAdı} olarak randevu almanızı öneririz.',
  },
]

const MOCK_LOGS: SendLog[] = [
  { id: 'l1', patientName: 'Ayşe Kaya',    aptDate: dayjs().subtract(1,'day').format('DD MMM YYYY'), channel: 'WhatsApp', status: 'sent',   sentAt: dayjs().subtract(1,'day').subtract(26,'hour').toISOString() },
  { id: 'l2', patientName: 'Mehmet Demir', aptDate: dayjs().subtract(1,'day').format('DD MMM YYYY'), channel: 'SMS',      status: 'sent',   sentAt: dayjs().subtract(1,'day').subtract(26,'hour').toISOString() },
  { id: 'l3', patientName: 'Fatma Öztürk', aptDate: dayjs().format('DD MMM YYYY'),                   channel: 'SMS',      status: 'failed', sentAt: dayjs().subtract(2,'hour').toISOString() },
  { id: 'l4', patientName: 'Ali Çelik',    aptDate: dayjs().format('DD MMM YYYY'),                   channel: 'Email',    status: 'sent',   sentAt: dayjs().subtract(3,'day').toISOString() },
  { id: 'l5', patientName: 'Zeynep Arslan', aptDate: dayjs().add(1,'day').format('DD MMM YYYY'),     channel: 'WhatsApp', status: 'sent',   sentAt: dayjs().subtract(1,'hour').toISOString() },
]

// ─── Helpers ──────────────────────────────────────────────────────────────── //

function loadRules(): ReminderRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES)
    return raw ? (JSON.parse(raw) as ReminderRule[]) : DEFAULT_RULES
  } catch { return DEFAULT_RULES }
}

function saveRules(rules: ReminderRule[]) {
  try { localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules)) } catch { /* ignore */ }
}

function loadLogs(): SendLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS)
    return raw ? (JSON.parse(raw) as SendLog[]) : MOCK_LOGS
  } catch { return MOCK_LOGS }
}

function renderTemplate(tpl: string): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    return (MOCK_PATIENT_DATA as Record<string, string>)[key] ?? `{${key}}`
  })
}

function timingLabel(rule: ReminderRule): string {
  const u = rule.unit === 'hour' ? 'saat' : 'gün'
  const t = rule.timing === 'before' ? 'önce' : 'sonra'
  return `Randevudan ${rule.amount} ${u} ${t}`
}

function channelIcon(ch: Channel) {
  if (ch === 'WhatsApp') return <span className="text-emerald-600 font-bold text-xs bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">WA</span>
  if (ch === 'SMS')      return <span className="text-blue-600   font-bold text-xs bg-blue-50   border border-blue-200   px-1.5 py-0.5 rounded-full">SMS</span>
  return <span className="text-purple-600 font-bold text-xs bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">E-posta</span>
}

const EMPTY_FORM: Omit<ReminderRule, 'id'> = {
  active: true, amount: 1, unit: 'hour', timing: 'before',
  channels: ['SMS'], template: '',
}

// ─── Component ────────────────────────────────────────────────────────────── //

export default function AutoRemindersPage() {
  const [rules, setRules]             = useState<ReminderRule[]>(loadRules)
  const [logs]                        = useState<SendLog[]>(loadLogs)
  const [showModal, setShowModal]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<Omit<ReminderRule, 'id'>>(EMPTY_FORM)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  useEffect(() => { document.title = 'Otomatik Hatırlatma – Medica.AI' }, [])
  useEffect(() => { saveRules(rules) }, [rules])

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (rule: ReminderRule) => {
    setEditingId(rule.id)
    setForm({ active: rule.active, amount: rule.amount, unit: rule.unit, timing: rule.timing, channels: [...rule.channels], template: rule.template })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.template.trim() || form.channels.length === 0) return
    if (editingId) {
      setRules(prev => prev.map(r => r.id === editingId ? { ...form, id: editingId } : r))
    } else {
      setRules(prev => [...prev, { ...form, id: `rule-${Date.now()}` }])
    }
    setShowModal(false)
  }

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
  }

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const toggleChannel = (ch: Channel) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }))
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  return (
    <DoctorLayout title="Otomatik Hatırlatma">
      <div className="max-w-3xl space-y-6">

        {/* ── Kural Listesi ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-800">Hatırlatma Kuralları</h2>
              <p className="text-xs text-gray-400 mt-0.5">{rules.filter(r => r.active).length} aktif kural</p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={15} /> Yeni Kural
            </button>
          </div>

          {rules.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Bell size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-600 font-semibold mb-1">Henüz kural yok</p>
              <p className="text-gray-400 text-sm mb-4">İlk hatırlatma kuralını oluşturmak için butona tıklayın.</p>
              <button onClick={openNew} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700">
                Kural Oluştur
              </button>
            </div>
          )}

          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${rule.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${rule.active ? 'bg-teal-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.active ? 'left-5' : 'left-0.5'}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Clock size={13} className="text-teal-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-800">{timingLabel(rule)}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {rule.channels.map(ch => <span key={ch}>{channelIcon(ch)}</span>)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 italic line-clamp-1">
                      "{rule.template.length > 80 ? rule.template.slice(0, 80) + '…' : rule.template}"
                    </p>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-teal-600 transition-colors">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gönderim Geçmişi ── */}
        <section>
          <h2 className="font-bold text-gray-800 mb-4">Gönderim Geçmişi</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare size={28} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">Henüz gönderim kaydı yok.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Hasta</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Randevu</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Kanal</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Durum</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Gönderim</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 10).map((log, i) => (
                    <tr key={log.id} className={i < logs.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-800">{log.patientName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{log.aptDate}</td>
                      <td className="px-4 py-3">{channelIcon(log.channel)}</td>
                      <td className="px-4 py-3">
                        {log.status === 'sent' ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <CheckCircle2 size={13} /> Gönderildi
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 text-xs font-semibold">
                            <X size={13} /> Başarısız
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{dayjs(log.sentAt).format('DD MMM HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* ── Kural Oluştur/Düzenle Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editingId ? 'Kuralı Düzenle' : 'Yeni Hatırlatma Kuralı'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Zamanlama */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Zamanlama</label>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="number" min={1} max={30} value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as Unit }))} className={inputCls + ' w-28'}>
                    <option value="hour">Saat</option>
                    <option value="day">Gün</option>
                  </select>
                  <select value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value as Timing }))} className={inputCls + ' w-28'}>
                    <option value="before">Önce</option>
                    <option value="after">Sonra</option>
                  </select>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">→ {timingLabel({ ...form, id: '' })}</p>
              </div>

              {/* Kanallar */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Kanallar</label>
                <div className="flex gap-2 flex-wrap">
                  {(['WhatsApp', 'SMS', 'Email'] as Channel[]).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.channels.includes(ch)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      {ch === 'WhatsApp' ? '📱 WhatsApp' : ch === 'SMS' ? '💬 SMS' : '✉️ E-posta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Şablon */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Mesaj Şablonu</label>
                <textarea
                  rows={3}
                  value={form.template}
                  onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
                  placeholder="Mesaj şablonunuzu yazın..."
                  className={inputCls + ' resize-none'}
                />
                {/* Değişken chip'leri */}
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, template: f.template + v.key }))}
                      className="text-[11px] bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors"
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Önizleme */}
              {form.template && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 w-full"
                  >
                    {previewExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Önizleme (örnek veriyle)
                  </button>
                  {previewExpanded && (
                    <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                      {renderTemplate(form.template)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={!form.template.trim() || form.channels.length === 0}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingId ? 'Güncelle' : 'Kaydet'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  )
}
