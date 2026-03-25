import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDoctorAppointments } from '../../services/appointmentApi'
import { invoiceApi } from '../../services/invoiceApi'
import { doctorApi } from '../../services/doctorApi'
import { useAuthStore } from '../../store/authStore'
import { sessionsAll, AnalysisSession } from '../../services/sessionStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  CalendarDays, ArrowRight, Clock, CheckCircle2, TrendingUp,
  ScanFace, Users, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  AlertTriangle, Star, Activity,
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

// ─── Analitik localStorage key ─────────────────────────────────────────────
const ANALYTICS_PREV_KEY = 'bk_dashboard_analytics_prev'

interface PrevStats { completionPct: number; cancelPct: number; noshowPct: number; fillRate: number }

type AptTab = 'Tümü' | 'Online' | 'Fiziksel'
type RevenueTab = 'Günlük' | 'Aylık' | 'Yıllık'

const STATUS_CFG = {
  Confirmed: { label: 'Onaylı',     cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  Pending:   { label: 'Beklemede',  cls: 'text-amber-700 bg-amber-50 border-amber-100' },
  Cancelled: { label: 'İptal',      cls: 'text-red-600 bg-red-50 border-red-100' },
  Completed: { label: 'Tamamlandı', cls: 'text-blue-700 bg-blue-50 border-blue-100' },
} as const

export default function DashboardPage() {
  const { userId } = useAuthStore()
  const today = dayjs()
  const todayStr = today.format('YYYY-MM-DD')

  const [aptTab, setAptTab] = useState<AptTab>('Tümü')
  const [revenueTab, setRevenueTab] = useState<RevenueTab>('Günlük')
  const [aiSessions, setAiSessions] = useState<AnalysisSession[]>([])

  useEffect(() => { document.title = 'Dashboard – Medica.AI' }, [])
  useEffect(() => { sessionsAll().then(setAiSessions).catch(() => {}) }, [])

  const { data: allApts = [], isLoading: loadingApts } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices(),
    staleTime: 2 * 60 * 1000,
  })

  const { data: doctor } = useQuery({
    queryKey: ['doctor-profile', userId],
    queryFn: () => doctorApi.getProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const apts = allApts as any[]
  const invList = invoices as any[]

  // Today's appointments
  const todayApts = apts
    .filter(a => a.appointmentDate === todayStr && a.status !== 'Cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Filter by type tab
  const filteredTodayApts = aptTab === 'Tümü'
    ? todayApts
    : todayApts.filter(a => {
        if (aptTab === 'Online') return a.type === 'Online'
        if (aptTab === 'Fiziksel') return a.type !== 'Online'
        return true
      })

  // Upcoming appointments
  const upcomingApts = apts
    .filter(a => a.appointmentDate > todayStr && a.status === 'Confirmed')
    .sort((a, b) =>
      `${a.appointmentDate}T${a.startTime}`.localeCompare(`${b.appointmentDate}T${b.startTime}`)
    )
    .slice(0, 6)

  // Revenue computation from paid invoices
  const paidInvoices = invList.filter(inv => inv.status === 'Paid')
  const computeRevenue = (tab: RevenueTab): number => {
    const monthStart = today.startOf('month').format('YYYY-MM-DD')
    const yearStart = today.startOf('year').format('YYYY-MM-DD')
    return paidInvoices
      .filter(inv => {
        const d = (inv.paidAt ?? inv.updatedAt ?? inv.createdAt ?? '').slice(0, 10)
        if (tab === 'Günlük') return d === todayStr
        if (tab === 'Aylık')  return d >= monthStart && d <= todayStr
        return d >= yearStart && d <= todayStr
      })
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
  }

  const revenue = computeRevenue(revenueTab)

  // ── Analytics hesaplamaları ────────────────────────────────────────────────
  const thisMonthStr  = today.startOf('month').format('YYYY-MM-DD')
  const lastMonthStart = today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
  const lastMonthEnd   = today.subtract(1, 'month').endOf('month').format('YYYY-MM-DD')

  const thisMonthRev = paidInvoices
    .filter(inv => (inv.paidAt ?? inv.updatedAt ?? inv.createdAt ?? '').slice(0, 10) >= thisMonthStr)
    .reduce((s, inv) => s + (Number(inv.total) || 0), 0)

  const lastMonthRev = paidInvoices
    .filter(inv => {
      const d = (inv.paidAt ?? inv.updatedAt ?? inv.createdAt ?? '').slice(0, 10)
      return d >= lastMonthStart && d <= lastMonthEnd
    })
    .reduce((s, inv) => s + (Number(inv.total) || 0), 0)

  const revGrowth = lastMonthRev === 0 ? null
    : ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100

  // Son 6 ay gelir dağılımı
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const m = today.subtract(5 - i, 'month')
    const start = m.startOf('month').format('YYYY-MM-DD')
    const end   = m.endOf('month').format('YYYY-MM-DD')
    const rev   = paidInvoices
      .filter(inv => {
        const d = (inv.paidAt ?? inv.updatedAt ?? inv.createdAt ?? '').slice(0, 10)
        return d >= start && d <= end
      })
      .reduce((s, inv) => s + (Number(inv.total) || 0), 0)
    return { label: m.format('MMM'), rev }
  })
  const maxRev = Math.max(...last6Months.map(m => m.rev), 1)

  // Hasta sayısı & tamamlanma oranı
  const uniquePatients = new Set(apts.map((a: any) => a.patientId ?? a.patientEmail)).size
  const completedApts  = apts.filter((a: any) => a.status === 'Completed').length
  const completionRate = apts.length === 0 ? 0 : Math.round((completedApts / apts.length) * 100)

  // AI analiz metrikleri
  const aiThisMonth = aiSessions.filter(s =>
    dayjs(s.createdAt).format('YYYY-MM') === today.format('YYYY-MM')
  ).length
  const avgScore = aiSessions.length
    ? Math.round(aiSessions.reduce((s, a) => s + a.symmetryScore, 0) / aiSessions.length)
    : null

  // ── 3A: No-Show & İptal Oranı ────────────────────────────────────────────
  const totalApts     = apts.length
  const cancelledApts = apts.filter((a: any) => a.status === 'Cancelled').length
  const noshowApts    = apts.filter((a: any) =>
    a.status === 'Pending' && a.appointmentDate < todayStr
  ).length
  const completionPct = totalApts === 0 ? 0 : Math.round((completedApts / totalApts) * 100)
  const cancelPct     = totalApts === 0 ? 0 : Math.round((cancelledApts / totalApts) * 100)
  const noshowPct     = totalApts === 0 ? 0 : Math.round((noshowApts / totalApts) * 100)

  // Doluluk: son 4 hafta ortalaması (günde max 8 randevu)
  const last28Days = Array.from({ length: 28 }, (_, i) => today.subtract(i, 'day').format('YYYY-MM-DD'))
  const daysWithApts = last28Days.filter(d => apts.some((a: any) => a.appointmentDate === d)).length
  const fillRate = Math.round((daysWithApts / 28) * 100)

  // Önceki haftanın trend verilerini localStorage'dan yükle / kaydet
  const prevStatsRef = useRef<PrevStats | null>(null)
  if (!prevStatsRef.current) {
    try {
      const raw = localStorage.getItem(ANALYTICS_PREV_KEY)
      prevStatsRef.current = raw ? (JSON.parse(raw) as PrevStats) : null
    } catch { prevStatsRef.current = null }
  }
  const prevStats = prevStatsRef.current

  // Her render'da güncelle (throttle yok, mount-only gibi davranır)
  useEffect(() => {
    try {
      localStorage.setItem(ANALYTICS_PREV_KEY, JSON.stringify({ completionPct, cancelPct, noshowPct, fillRate }))
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trendArrow(cur: number, prev: number | undefined, higherIsBetter = true) {
    if (prev === undefined) return null
    const diff = cur - prev
    if (Math.abs(diff) < 1) return <Minus size={12} className="text-gray-400" />
    const up = diff > 0
    const good = higherIsBetter ? up : !up
    return up
      ? <ArrowUpRight size={12} className={good ? 'text-emerald-500' : 'text-red-500'} />
      : <ArrowDownRight size={12} className={good ? 'text-emerald-500' : 'text-red-500'} />
  }

  // ── 3B: Tedavi Tipi Dağılımı (Donut) ─────────────────────────────────────
  interface ServiceCount { name: string; count: number; color: string }
  const DONUT_COLORS = ['#0d9488','#7c3aed','#f59e0b','#ec4899','#3b82f6','#10b981','#f97316']
  const serviceMap = new Map<string, number>()
  invList.forEach((inv: any) => {
    ;(inv.items ?? []).forEach((item: any) => {
      const name = item.serviceName ?? item.serviceId ?? 'Diğer'
      serviceMap.set(name, (serviceMap.get(name) ?? 0) + (item.quantity ?? 1))
    })
  })
  const serviceList: ServiceCount[] = Array.from(serviceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, count], i) => ({ name, count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
  const totalServices = serviceList.reduce((s, x) => s + x.count, 0)

  // SVG Donut arcs
  function donutArcs(items: ServiceCount[], total: number) {
    if (total === 0) return []
    const R = 60; const CX = 70; const CY = 70
    let angle = -Math.PI / 2
    return items.map(item => {
      const frac  = item.count / total
      const sweep = frac * 2 * Math.PI
      const x1 = CX + R * Math.cos(angle)
      const y1 = CY + R * Math.sin(angle)
      angle += sweep
      const x2 = CX + R * Math.cos(angle)
      const y2 = CY + R * Math.sin(angle)
      const large = sweep > Math.PI ? 1 : 0
      return { path: `M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`, color: item.color, item }
    })
  }
  const arcs = donutArcs(serviceList, totalServices)

  // ── 3C: Hasta Kohort ──────────────────────────────────────────────────────
  const thirtyDaysAgo = today.subtract(30, 'day').format('YYYY-MM-DD')
  const ninetyDaysAgo = today.subtract(90, 'day').format('YYYY-MM-DD')

  // Hasta → randevu listesi map
  const patientAptMap = new Map<string, string[]>()
  apts.forEach((a: any) => {
    const pid = String(a.patientId ?? a.patientEmail ?? '')
    if (!pid) return
    const list = patientAptMap.get(pid) ?? []
    list.push(a.appointmentDate as string)
    patientAptMap.set(pid, list)
  })

  let newPatients = 0, returningPatients = 0, atRiskPatients = 0
  patientAptMap.forEach((dates) => {
    const sorted = [...dates].sort()
    const first  = sorted[0]
    const last   = sorted[sorted.length - 1]
    if (first >= thirtyDaysAgo) newPatients++
    if (sorted.length >= 2)     returningPatients++
    if (last < ninetyDaysAgo)   atRiskPatients++
  })

  // ── 3D: Haftalık Doluluk Heatmap ─────────────────────────────────────────
  const DAYS  = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  const HOURS = Array.from({ length: 11 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`)

  // heatmap[dayIndex][hourIndex] = count
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(11).fill(0))
  apts.forEach((a: any) => {
    const dow = dayjs(a.appointmentDate).day() // 0=Sun
    const di  = dow === 0 ? 6 : dow - 1        // Mon=0 … Sun=6
    const hr  = parseInt((a.startTime ?? '00:00').slice(0, 2), 10)
    const hi  = hr - 9
    if (di >= 0 && di < 7 && hi >= 0 && hi < 11) heatmap[di][hi]++
  })
  const maxHeat = Math.max(...heatmap.flat(), 1)

  // Busiest slot
  let busiestDay = 0, busiestHour = 0, busiestCount = 0
  heatmap.forEach((row, di) => row.forEach((cnt, hi) => {
    if (cnt > busiestCount) { busiestCount = cnt; busiestDay = di; busiestHour = hi }
  }))

  const hour = today.hour()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const displayName = doctor ? `${doctor.title ?? ''} ${doctor.fullName ?? ''}`.trim() : ''

  const aptTabCls = (t: AptTab) =>
    t === aptTab
      ? 'text-teal-600 border-b-2 border-teal-500 font-semibold'
      : 'text-gray-400 hover:text-gray-600'

  const revTabCls = (t: RevenueTab) =>
    t === revenueTab
      ? 'bg-teal-50 text-teal-700 font-semibold'
      : 'text-gray-400 hover:text-gray-600'

  return (
    <DoctorLayout title={`${greeting}${displayName ? `, ${displayName}` : ''}!`}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Date subtitle */}
        <p className="text-sm text-gray-400 -mt-2">
          <span className="capitalize">{today.format('DD MMMM YYYY, dddd')}</span>
          {' · '}Bugün harika bir gün! İşte güncel durumunuz ve performans özeti.
        </p>

        {/* Main grid: left content + right widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── LEFT: Upcoming appointments ─────────────────── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Upcoming Appointments */}
            <section aria-labelledby="upcoming-label">
              <div className="flex items-center justify-between mb-3">
                <h2
                  id="upcoming-label"
                  className="text-xs font-bold text-gray-400 uppercase tracking-widest"
                >
                  Yaklaşan Randevular
                </h2>
                <Link
                  to="/doctor/calendar"
                  className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Tümünü Gör <ArrowRight size={12} />
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {loadingApts ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 animate-pulse bg-gray-50 border-b border-gray-50" />
                  ))
                ) : upcomingApts.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <CalendarDays size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">Yaklaşan onaylı randevu yok</p>
                  </div>
                ) : (
                  upcomingApts.map((apt: any, i: number) => {
                    const cfg = STATUS_CFG[apt.status as keyof typeof STATUS_CFG]
                      ?? { label: apt.status, cls: 'text-gray-600 bg-gray-50 border-gray-100' }
                    return (
                      <div
                        key={apt.id}
                        className={`flex items-center gap-3 px-4 py-3 ${i < upcomingApts.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-teal-600">
                          {dayjs(apt.appointmentDate).format('DD')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {dayjs(apt.appointmentDate).format('DD MMM')} · {apt.startTime?.slice(0, 5)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{apt.patientEmail}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {apt.type === 'Online' && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Online</span>
                          )}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

          </div>

          {/* ── RIGHT: Bugün widget + Tahsilatlarım ─────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Bugün widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Purple/teal header like reference */}
              <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-white" />
                  <div>
                    <p className="text-white font-bold text-sm">Bugün</p>
                    <p className="text-teal-100 text-xs">
                      {todayApts.length} Randevu
                    </p>
                  </div>
                </div>
                <Link
                  to="/doctor/calendar"
                  className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  Takvim <ArrowRight size={11} />
                </Link>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-4 gap-4">
                {(['Tümü', 'Online', 'Fiziksel'] as AptTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setAptTab(t)}
                    className={`py-2.5 text-xs transition-colors ${aptTabCls(t)}`}
                  >
                    {t}
                    {t === 'Tümü' && todayApts.length > 0 && (
                      <span className="ml-1 bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {todayApts.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Appointment list */}
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {loadingApts ? (
                  [1, 2].map(i => (
                    <div key={i} className="h-12 animate-pulse bg-gray-50 m-3 rounded-xl" />
                  ))
                ) : filteredTodayApts.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-gray-200" />
                    <p className="text-xs text-gray-400">Bugün için randevu bulunmuyor.</p>
                  </div>
                ) : (
                  filteredTodayApts.map((apt: any) => {
                    const cfg = STATUS_CFG[apt.status as keyof typeof STATUS_CFG]
                      ?? { label: apt.status, cls: 'text-gray-600 bg-gray-50 border-gray-100' }
                    return (
                      <div key={apt.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{apt.patientEmail}</p>
                          <p className="text-[11px] text-gray-400">{apt.startTime?.slice(0, 5)}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Tahsilatlarım widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <p className="font-bold text-gray-800 text-sm">Tahsilatlarım</p>
                  <p className="text-xs text-gray-400">{paidInvoices.length} ödenmiş fatura</p>
                </div>
                <Link
                  to="/doctor/invoices"
                  className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Rapora Git <ArrowRight size={11} />
                </Link>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 px-4 pb-3">
                {(['Günlük', 'Aylık', 'Yıllık'] as RevenueTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setRevenueTab(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${revTabCls(t)}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Revenue */}
              <div className="px-4 pb-4">
                {loadingInvoices ? (
                  <div className="h-10 animate-pulse bg-gray-100 rounded-xl" />
                ) : (
                  <div className="flex items-center gap-3 bg-teal-50 rounded-xl px-4 py-3">
                    <TrendingUp size={18} className="text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="text-xl font-bold text-teal-700">
                        ₺{revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-teal-500">
                        {revenueTab === 'Günlük' ? 'Bugün' : revenueTab === 'Aylık' ? 'Bu Ay' : 'Bu Yıl'} toplam tahsilat
                      </p>
                    </div>
                  </div>
                )}
                {!loadingInvoices && revenue === 0 && (
                  <p className="text-center text-xs text-gray-400 mt-2">Kayıt bulunamadı.</p>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── ROI & Klinik Analitik ──────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto space-y-4 mt-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-teal-600" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Klinik Özeti & ROI</h2>
        </div>

        {/* KPI Kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Bu ay gelir */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                <TrendingUp size={15} className="text-teal-600" />
              </div>
              {revGrowth !== null && (
                <span className={`flex items-center gap-0.5 text-xs font-bold ${
                  revGrowth > 0 ? 'text-emerald-600' : revGrowth < 0 ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {revGrowth > 0 ? <ArrowUpRight size={12}/> : revGrowth < 0 ? <ArrowDownRight size={12}/> : <Minus size={12}/>}
                  {Math.abs(revGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-gray-900">
              ₺{thisMonthRev.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Bu ay gelir</p>
            {revGrowth !== null && (
              <p className="text-[11px] text-gray-300 mt-1">
                Geçen ay: ₺{lastMonthRev.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
              </p>
            )}
          </div>

          {/* Aktif Hasta */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
              <Users size={15} className="text-violet-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{uniquePatients}</p>
            <p className="text-xs text-gray-400 mt-0.5">Toplam hasta</p>
            <p className="text-[11px] text-gray-300 mt-1">{apts.length} randevu toplam</p>
          </div>

          {/* Tamamlanma Oranı */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <CheckCircle2 size={15} className="text-blue-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{completionRate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Randevu tamamlanma</p>
            <p className="text-[11px] text-gray-300 mt-1">{completedApts} / {apts.length} tamamlandı</p>
          </div>

          {/* AI Analiz */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <ScanFace size={15} className="text-amber-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{aiSessions.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Toplam AI analiz</p>
            <p className="text-[11px] text-gray-300 mt-1">
              {aiThisMonth > 0 ? `Bu ay: ${aiThisMonth}` : 'Bu ay henüz yok'}
              {avgScore !== null ? ` · Ort. ${avgScore}` : ''}
            </p>
          </div>
        </div>

        {/* 6 Aylık Gelir Grafiği */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-bold text-gray-800">6 Aylık Gelir Grafiği</p>
              <p className="text-xs text-gray-400">Aylık tahsilat trendi</p>
            </div>
            <Link
              to="/doctor/invoices"
              className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1"
            >
              Detay <ArrowRight size={11} />
            </Link>
          </div>
          <div className="flex items-end gap-3 h-36">
            {last6Months.map((m, i) => {
              const pct    = maxRev > 0 ? (m.rev / maxRev) * 100 : 0
              const isLast = i === last6Months.length - 1
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-gray-500">
                    {m.rev > 0 ? `₺${(m.rev / 1000).toFixed(0)}K` : ''}
                  </span>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${
                        isLast ? 'bg-teal-500' : 'bg-teal-100'
                      }`}
                      style={{ height: `${Math.max(pct, pct > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium capitalize ${isLast ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── ANALİTİK PRO ─────────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto space-y-5 mt-4">

        <div className="flex items-center gap-2">
          <Activity size={16} className="text-teal-600" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Gelişmiş Analitik</h2>
        </div>

        {/* 3A — No-Show & İptal Oranı */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">No-Show & İptal Analizi</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Tamamlanma',   value: completionPct, prev: prevStats?.completionPct, unit: '%', higherBetter: true,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'İptal',        value: cancelPct,     prev: prevStats?.cancelPct,     unit: '%', higherBetter: false, color: 'text-red-600',     bg: 'bg-red-50' },
              { label: 'No-Show',      value: noshowPct,     prev: prevStats?.noshowPct,     unit: '%', higherBetter: false, color: 'text-amber-600',   bg: 'bg-amber-50' },
              { label: 'Ortalama Doluluk', value: fillRate,  prev: prevStats?.fillRate,      unit: '%', higherBetter: true,  color: 'text-blue-600',    bg: 'bg-blue-50' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  {trendArrow(stat.value, stat.prev, stat.higherBetter)}
                </div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}<span className="text-sm font-normal">{stat.unit}</span></p>
                {stat.prev !== undefined && (
                  <p className="text-[10px] text-gray-400 mt-1">Önceki: {stat.prev}{stat.unit}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-400 flex gap-4">
            <span>Toplam randevu: <strong className="text-gray-600">{totalApts}</strong></span>
            <span>Tamamlanan: <strong className="text-emerald-600">{completedApts}</strong></span>
            <span>İptal: <strong className="text-red-500">{cancelledApts}</strong></span>
            <span>No-Show: <strong className="text-amber-500">{noshowApts}</strong></span>
          </div>
        </div>

        {/* 3B + 3C yan yana */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 3B — Tedavi Tipi Dağılımı Donut */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-800 mb-4">Tedavi Tipi Dağılımı</p>
            {totalServices === 0 ? (
              <div className="text-center py-8">
                <BarChart3 size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">Fatura kalemi bulunamadı.</p>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                {/* SVG Donut */}
                <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
                  {arcs.map((arc, i) => (
                    <path key={i} d={arc.path} fill={arc.color} opacity={0.9} />
                  ))}
                  {/* center hole */}
                  <circle cx="70" cy="70" r="42" fill="white" />
                  <text x="70" y="67" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111827">{totalServices}</text>
                  <text x="70" y="82" textAnchor="middle" fontSize="9" fill="#9ca3af">toplam</text>
                </svg>
                {/* Legend */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  {serviceList.map(s => (
                    <div key={s.name} className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-gray-600 truncate flex-1">{s.name}</span>
                      <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{Math.round((s.count / totalServices) * 100)}%</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">({s.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3C — Hasta Kohort */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-800 mb-4">Hasta Kohort Analizi</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Users size={15} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Yeni Hastalar</p>
                    <p className="text-[11px] text-emerald-600">Son 30 gün ilk randevu</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{newPatients}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Star size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Geri Dönen Hastalar</p>
                    <p className="text-[11px] text-blue-600">2+ randevu</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">{returningPatients}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                    <AlertTriangle size={15} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Kayıp Riskli</p>
                    <p className="text-[11px] text-red-500">90+ gün randevusuz</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {atRiskPatients > 0 && (
                    <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">!</span>
                  )}
                  <p className="text-2xl font-bold text-red-600">{atRiskPatients}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D — Haftalık Doluluk Heatmap */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-gray-800">Haftalık Doluluk Heatmap'i</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {busiestCount > 0
                  ? `En yoğun zaman: ${DAYS[busiestDay]} ${HOURS[busiestHour]} (${busiestCount} randevu)`
                  : 'Henüz randevu verisi yok'}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-[10px] border-separate border-spacing-1 mx-auto">
              <thead>
                <tr>
                  <td className="w-8" />
                  {HOURS.map(h => (
                    <td key={h} className="text-center text-gray-400 font-medium px-0.5 pb-1 w-9">{h.slice(0, 5)}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => (
                  <tr key={day}>
                    <td className="text-gray-500 font-semibold pr-2 text-right w-8">{day}</td>
                    {HOURS.map((_h, hi) => {
                      const cnt     = heatmap[di][hi]
                      const opacity = cnt === 0 ? 0 : Math.max(0.12, cnt / maxHeat)
                      const isBusiest = di === busiestDay && hi === busiestHour && cnt > 0
                      return (
                        <td key={hi} title={cnt > 0 ? `${cnt} randevu` : 'Boş'}>
                          <div
                            className={`w-9 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold transition-all ${
                              isBusiest ? 'ring-2 ring-teal-400' : ''
                            }`}
                            style={{
                              background: cnt === 0 ? '#f9fafb' : `rgba(13,148,136,${opacity})`,
                              color: opacity > 0.5 ? '#fff' : cnt > 0 ? '#0d9488' : '#e5e7eb',
                            }}
                          >
                            {cnt > 0 ? cnt : ''}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-[10px] text-gray-400">Az</span>
            {[0.12, 0.3, 0.5, 0.7, 1].map(o => (
              <div key={o} className="w-4 h-4 rounded" style={{ background: `rgba(13,148,136,${o})` }} />
            ))}
            <span className="text-[10px] text-gray-400">Çok</span>
          </div>
        </div>

      </div>

    </DoctorLayout>
  )
}
