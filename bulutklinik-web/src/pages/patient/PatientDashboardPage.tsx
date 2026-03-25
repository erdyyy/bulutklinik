import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { patientApi } from '../../services/patientApi'
import { getMyAppointments } from '../../services/appointmentApi'
import PatientLayout from '../../components/patient/PatientLayout'
import {
  CalendarDays, CheckCircle2, FolderOpen, ArrowRight,
  Clock, AlertCircle
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

const STATUS_CFG = {
  Confirmed: { label: 'Onaylı',     cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  Pending:   { label: 'Beklemede',  cls: 'text-amber-700 bg-amber-50 border-amber-100' },
  Cancelled: { label: 'İptal',      cls: 'text-red-600 bg-red-50 border-red-100' },
  Completed: { label: 'Tamamlandı', cls: 'text-blue-700 bg-blue-50 border-blue-100' },
} as const

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
}

export default function PatientDashboardPage() {
  const { userId } = useAuthStore()

  useEffect(() => {
    document.title = 'Ana Sayfa – BulutKlinik'
  }, [])

  const { data: appointments = [], isLoading: loadingApts } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: getMyAppointments,
    staleTime: 2 * 60 * 1000,
  })

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: patientApi.getProfile,
    staleTime: 5 * 60 * 1000,
  })

  const { data: docs = [] } = useQuery({
    queryKey: ['my-documents', userId],
    queryFn: () => patientApi.getDocuments(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const now = dayjs()
  const apts = appointments as any[]
  const allDocs = docs as any[]

  const upcoming = apts
    .filter(a => a.status !== 'Cancelled' && dayjs(`${a.appointmentDate}T${a.startTime}`).isAfter(now))
    .sort((a, b) => dayjs(`${a.appointmentDate}T${a.startTime}`).diff(dayjs(`${b.appointmentDate}T${b.startTime}`)))

  const nextApt = upcoming[0]
  const completed = apts.filter(a => a.status === 'Completed').length

  const hour = now.hour()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'Hasta'

  const stats = [
    { label: 'Toplam Randevu', value: apts.length, Icon: CalendarDays, color: 'text-gray-900', iconColor: 'text-blue-500 bg-blue-50' },
    { label: 'Yaklaşan',       value: upcoming.length, Icon: Clock,       color: 'text-blue-600', iconColor: 'text-indigo-500 bg-indigo-50' },
    { label: 'Tamamlanan',     value: completed,       Icon: CheckCircle2, color: 'text-emerald-600', iconColor: 'text-emerald-500 bg-emerald-50' },
    { label: 'Belgeler',       value: allDocs.length,  Icon: FolderOpen,  color: 'text-gray-900', iconColor: 'text-orange-500 bg-orange-50' },
  ]

  return (
    <PatientLayout title={`${greeting}, ${displayName}!`}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Date */}
        <p className="text-sm text-gray-400 -mt-2 capitalize">{now.format('DD MMMM YYYY, dddd')}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingApts
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : stats.map(({ label, value, Icon, color, iconColor }) => (
                <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconColor}`}>
                    <Icon size={18} />
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
                </div>
              ))
          }
        </div>

        {/* Next appointment or empty state */}
        {!loadingApts && (
          nextApt ? (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-blue-300" />
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Sonraki Randevunuz</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {nextApt.doctorName?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{nextApt.doctorName}</p>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {dayjs(nextApt.appointmentDate).format('DD MMMM YYYY')} · {nextApt.startTime?.slice(0, 5)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/20 text-white px-2.5 py-1 rounded-full">
                      <AlertCircle size={11} />
                      {dayjs(`${nextApt.appointmentDate}T${nextApt.startTime}`).diff(now, 'day') === 0
                        ? 'Bugün!'
                        : dayjs(`${nextApt.appointmentDate}T${nextApt.startTime}`).diff(now, 'day') === 1
                        ? 'Yarın'
                        : `${dayjs(`${nextApt.appointmentDate}T${nextApt.startTime}`).diff(now, 'day')} gün sonra`
                      }
                    </span>
                    <span className="text-xs text-blue-200 capitalize">{nextApt.type === 'Online' ? '💻 Online' : '🏥 Yüz Yüze'}</span>
                  </div>
                </div>
                <Link
                  to="/my-appointments"
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  Detay <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-dashed border-gray-200 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-700">Yaklaşan randevunuz yok</p>
                <p className="text-sm text-gray-400 mt-0.5">Doktorunuzla hemen randevu oluşturun</p>
              </div>
              <Link
                to="/book"
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                Randevu Al
              </Link>
            </div>
          )
        )}

        {/* Quick actions */}
        <section aria-labelledby="quick-actions">
          <h2 id="quick-actions" className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Hızlı Erişim</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { to: '/book',             icon: '📅', label: 'Randevu Al',        desc: 'Doktor ile görüş',         bg: 'bg-blue-600 text-white', descCls: 'text-blue-200' },
              { to: '/my-appointments',  icon: '🗓️', label: 'Randevularım',      desc: `${upcoming.length} yaklaşan`, bg: 'bg-white border border-gray-100 text-gray-800', descCls: 'text-gray-400' },
              { to: '/my-records',       icon: '🩺', label: 'Muayene Geçmişi',   desc: 'Tüm kayıtlarım',           bg: 'bg-white border border-gray-100 text-gray-800', descCls: 'text-gray-400' },
              { to: '/my-measurements',  icon: '📊', label: 'Ölçümlerim',        desc: 'Kan basıncı, kilo...',      bg: 'bg-white border border-gray-100 text-gray-800', descCls: 'text-gray-400' },
              { to: '/my-documents',     icon: '📁', label: 'Belgelerim',        desc: `${allDocs.length} belge`,   bg: 'bg-white border border-gray-100 text-gray-800', descCls: 'text-gray-400' },
              { to: '/my-profile',       icon: '👤', label: 'Profilim',          desc: 'Bilgilerimi düzenle',       bg: 'bg-white border border-gray-100 text-gray-800', descCls: 'text-gray-400' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`${item.bg} rounded-2xl p-4 hover:opacity-90 transition-all active:scale-[0.98] hover:shadow-sm`}
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="font-semibold text-sm leading-tight">{item.label}</p>
                <p className={`text-xs mt-0.5 ${item.descCls}`}>{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent appointments */}
        {apts.length > 0 && (
          <section aria-labelledby="recent-apts">
            <div className="flex items-center justify-between mb-3">
              <h2 id="recent-apts" className="text-xs font-bold text-gray-400 uppercase tracking-widest">Son Randevular</h2>
              <Link to="/my-appointments" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
                Tümü <ArrowRight size={12} />
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {apts.slice(0, 4).map((apt: any, i: number) => {
                const cfg = STATUS_CFG[apt.status as keyof typeof STATUS_CFG] ?? { label: apt.status, cls: 'text-gray-600 bg-gray-50 border-gray-100' }
                return (
                  <div key={apt.id} className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? 'border-b border-gray-50' : ''}`}>
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                      {apt.doctorName?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{apt.doctorName}</p>
                      <p className="text-xs text-gray-400">{dayjs(apt.appointmentDate).format('DD MMM YYYY')}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </PatientLayout>
  )
}
