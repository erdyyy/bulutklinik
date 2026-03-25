import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDoctorAppointments } from '../../services/appointmentApi'
import { invoiceApi } from '../../services/invoiceApi'
import { useAuthStore } from '../../store/authStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  Heart, Gift, AlertTriangle, Star, MessageSquare,
  X, CheckCircle2, ChevronRight, Users,
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

// ─── Types ────────────────────────────────────────────────────────────────── //

type MsgChannel = 'WhatsApp' | 'SMS' | 'Email'
type MsgTemplate = 'birthday' | 'winback' | 'vip' | 'custom'

interface CrmLog {
  id:          string
  patientName: string
  channel:     MsgChannel
  template:    MsgTemplate
  message:     string
  sentAt:      string
}

const CRM_LOG_KEY = 'bk_crm_logs'

// ─── Mock doğum günü hastaları ────────────────────────────────────────────── //

const TODAY_BD: { name: string; age: number; phone: string }[] = [
  { name: 'Ayşe Kaya',     age: 34, phone: '+90 532 111 22 33' },
  { name: 'Zeynep Arslan', age: 28, phone: '+90 542 444 55 66' },
]

const WEEK_BD: { name: string; daysUntil: number; date: string }[] = [
  { name: 'Fatma Öztürk', daysUntil: 2, date: dayjs().add(2, 'day').format('DD MMMM') },
  { name: 'Merve Yıldız',  daysUntil: 5, date: dayjs().add(5, 'day').format('DD MMMM') },
  { name: 'Elif Çelik',    daysUntil: 6, date: dayjs().add(6, 'day').format('DD MMMM') },
]

// ─── Message templates ────────────────────────────────────────────────────── //

const TEMPLATES: Record<MsgTemplate, { label: string; text: string }> = {
  birthday: {
    label: 'Doğum Günü',
    text:  'Sayın {hastaAdı}, doğum gününüzü içtenlikle kutlarız! 🎂 Size özel %15 indirim fırsatı sunuyoruz. İyi ki doğdunuz! — BulutKlinik',
  },
  winback: {
    label: 'Geri Kazan',
    text:  'Sayın {hastaAdı}, sizi özledik! Son ziyaretinizden bu yana {gün} gün geçti. Yeni tedavi seçeneklerimizi keşfetmek için randevu alın. — BulutKlinik',
  },
  vip: {
    label: 'VIP Teklif',
    text:  'Sayın {hastaAdı}, değerli hastamız olarak size özel bir teklif sunmak istiyoruz. Detaylar için lütfen bizi arayın. — BulutKlinik',
  },
  custom: {
    label: 'Özel Mesaj',
    text:  '',
  },
}

function loadLogs(): CrmLog[] {
  try {
    const raw = localStorage.getItem(CRM_LOG_KEY)
    return raw ? (JSON.parse(raw) as CrmLog[]) : []
  } catch { return [] }
}

function saveLog(log: CrmLog) {
  try {
    const logs = loadLogs()
    localStorage.setItem(CRM_LOG_KEY, JSON.stringify([log, ...logs].slice(0, 50)))
  } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────── //

export default function CrmPage() {
  const { userId } = useAuthStore()

  useEffect(() => { document.title = 'Hasta CRM – BulutKlinik' }, [])

  const { data: allApts = [] } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices(),
    staleTime: 2 * 60 * 1000,
  })

  const apts     = allApts as Record<string, unknown>[]
  const invList  = invoices as Record<string, unknown>[]
  const today    = dayjs()
  const sixtyDaysAgo  = today.subtract(60, 'day').format('YYYY-MM-DD')

  // ── Kayıp hastalar ────────────────────────────────────────────────────────
  const patientLastApt = new Map<string, { date: string; name: string; totalApts: number }>()
  apts.forEach(a => {
    const pid  = String(a.patientId ?? a.patientEmail ?? '')
    const name = String(a.patientEmail ?? pid)
    const date = String(a.appointmentDate ?? '')
    if (!pid) return
    const cur = patientLastApt.get(pid)
    if (!cur || date > cur.date) {
      patientLastApt.set(pid, { date, name, totalApts: (cur?.totalApts ?? 0) + 1 })
    } else {
      patientLastApt.set(pid, { ...cur, totalApts: cur.totalApts + 1 })
    }
  })

  interface LostPatient { pid: string; name: string; lastDate: string; daysSince: number; totalApts: number }
  const lostPatients: LostPatient[] = []
  patientLastApt.forEach(({ date, name, totalApts }, pid) => {
    if (date < sixtyDaysAgo) {
      lostPatients.push({ pid, name, lastDate: date, daysSince: today.diff(dayjs(date), 'day'), totalApts })
    }
  })
  lostPatients.sort((a, b) => b.daysSince - a.daysSince)

  // ── VIP hastalar ──────────────────────────────────────────────────────────
  const patientRevenue = new Map<string, number>()
  invList.forEach(inv => {
    if (inv.status !== 'Paid') return
    const pid = String(inv.patientId ?? '')
    if (!pid) return
    patientRevenue.set(pid, (patientRevenue.get(pid) ?? 0) + (Number(inv.total ?? inv.totalAmount) || 0))
  })

  interface VipPatient { pid: string; name: string; totalApts: number; revenue: number; lastDate: string }
  const vipList: VipPatient[] = []
  patientLastApt.forEach(({ date, name, totalApts }, pid) => {
    const revenue = patientRevenue.get(pid) ?? 0
    vipList.push({ pid, name, totalApts, revenue, lastDate: date })
  })
  vipList.sort((a, b) => b.revenue - a.revenue || b.totalApts - a.totalApts)
  const top5Vip = vipList.slice(0, 5)

  // ── Mesaj compose modal ───────────────────────────────────────────────────
  const [showCompose, setShowCompose]   = useState(false)
  const [composeTarget, setComposeTarget] = useState('')
  const [channel, setChannel]           = useState<MsgChannel>('WhatsApp')
  const [template, setTemplate]         = useState<MsgTemplate>('birthday')
  const [message, setMessage]           = useState(TEMPLATES.birthday.text)
  const [sent, setSent]                 = useState(false)

  const openCompose = (targetName: string, tpl: MsgTemplate) => {
    setComposeTarget(targetName)
    setTemplate(tpl)
    setMessage(TEMPLATES[tpl].text.replace('{hastaAdı}', targetName))
    setSent(false)
    setShowCompose(true)
  }

  const handleTemplateChange = (tpl: MsgTemplate) => {
    setTemplate(tpl)
    setMessage(TEMPLATES[tpl].text.replace('{hastaAdı}', composeTarget))
  }

  const handleSend = () => {
    const log: CrmLog = {
      id: `crm-${Date.now()}`,
      patientName: composeTarget,
      channel,
      template,
      message,
      sentAt: new Date().toISOString(),
    }
    saveLog(log)
    setSent(true)
    setTimeout(() => { setShowCompose(false); setSent(false) }, 1500)
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  return (
    <DoctorLayout title="Hasta CRM">
      <div className="max-w-4xl space-y-6">

        {/* ── Bölüm 1: Bugünün Doğum Günleri ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Gift size={18} className="text-rose-500" />
            <h2 className="font-bold text-gray-800">Bugünün Doğum Günleri</h2>
            {TODAY_BD.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{TODAY_BD.length}</span>
            )}
          </div>

          {TODAY_BD.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Gift size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400">Bugün doğum günü olan hasta yok.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {TODAY_BD.map(p => (
                <div key={p.name} className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xl flex-shrink-0">
                    🎂
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{p.name}</p>
                    <p className="text-sm text-rose-600">{p.age} yaşında · {p.phone}</p>
                  </div>
                  <button
                    onClick={() => openCompose(p.name, 'birthday')}
                    className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
                  >
                    <MessageSquare size={13} /> Tebrik Et
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bu hafta doğum günleri */}
          {WEEK_BD.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Bu Hafta</p>
              <div className="space-y-2">
                {WEEK_BD.map(p => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎁</span>
                      <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{p.date} ({p.daysUntil} gün sonra)</span>
                      <button onClick={() => openCompose(p.name, 'birthday')}
                        className="text-xs text-teal-600 hover:underline font-semibold">Hatırlat</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Bölüm 2: Kayıp Hasta Uyarıları ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="font-bold text-gray-800">Kayıp Hasta Uyarıları</h2>
            {lostPatients.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{lostPatients.length}</span>
            )}
          </div>

          {lostPatients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-500 font-medium mb-1">Harika!</p>
              <p className="text-gray-400 text-sm">60+ gün randevusu olmayan hasta yok.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Hasta</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Son Randevu</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Geçen Süre</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Toplam</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lostPatients.slice(0, 15).map((p, i) => (
                    <tr key={p.pid} className={i < lostPatients.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{dayjs(p.lastDate).format('DD MMM YYYY')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.daysSince >= 90 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {p.daysSince} gün
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.totalApts} randevu</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openCompose(p.name, 'winback')}
                          className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold whitespace-nowrap"
                        >
                          Geri Kazan <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Bölüm 3: VIP Hasta Segmenti ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-amber-500" />
            <h2 className="font-bold text-gray-800">VIP Hasta Segmenti</h2>
          </div>

          {top5Vip.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Users size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm">VIP hasta verisi için randevu ve fatura gereklidir.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">#</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Hasta</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Toplam Randevu</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Toplam Harcama</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Son Ziyaret</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {top5Vip.map((p, i) => (
                    <tr key={p.pid} className={i < top5Vip.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                        }`}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <div className="flex items-center gap-1.5">
                          {i === 0 && <Star size={12} className="text-amber-500" />}
                          {p.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.totalApts} randevu</td>
                      <td className="px-4 py-3 font-semibold text-teal-700">
                        {p.revenue > 0 ? `₺${p.revenue.toLocaleString('tr-TR')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{dayjs(p.lastDate).format('DD MMM YYYY')}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openCompose(p.name, 'vip')}
                          className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs font-semibold whitespace-nowrap"
                        >
                          Teklif Gönder <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {/* ── Mesaj Compose Modal ── */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Mesaj Gönder</h3>
                <p className="text-xs text-gray-400 mt-0.5">{composeTarget}</p>
              </div>
              <button onClick={() => setShowCompose(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Kanal */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Kanal</label>
                <div className="flex gap-2">
                  {(['WhatsApp', 'SMS', 'Email'] as MsgChannel[]).map(ch => (
                    <button key={ch} onClick={() => setChannel(ch)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        channel === ch ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'
                      }`}>
                      {ch === 'WhatsApp' ? '📱 WA' : ch === 'SMS' ? '💬 SMS' : '✉️ E-posta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Şablon */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Şablon</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.entries(TEMPLATES) as [MsgTemplate, typeof TEMPLATES[MsgTemplate]][]).map(([key, tpl]) => (
                    <button key={key} onClick={() => handleTemplateChange(key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        template === key ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'
                      }`}>
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mesaj */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Mesaj</label>
                <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
                  className={inputCls + ' resize-none'} />
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-gray-100">
              {sent ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 rounded-xl text-emerald-700 text-sm font-semibold">
                  <CheckCircle2 size={16} /> Gönderildi!
                </div>
              ) : (
                <button onClick={handleSend} disabled={!message.trim()}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <Heart size={14} /> Gönder
                </button>
              )}
              <button onClick={() => setShowCompose(false)} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  )
}
