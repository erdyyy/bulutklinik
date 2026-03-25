import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyAppointments, updateStatus, submitReview, getReview } from '../../services/appointmentApi'
import PatientLayout from '../../components/patient/PatientLayout'
import { X, Star, Calendar, Clock, MapPin, Video, ChevronRight, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

type FilterTab = 'upcoming' | 'all' | 'past' | 'cancelled'

const STATUS_CFG = {
  Confirmed: { label: 'Onaylı',     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  Pending:   { label: 'Beklemede',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  Cancelled: { label: 'İptal',      cls: 'text-red-500 bg-red-50 border-red-200' },
  Completed: { label: 'Tamamlandı', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
} as const

const STAR_LABELS = ['', 'Çok Kötü', 'Kötü', 'Orta', 'İyi', 'Mükemmel']

function ReviewModal({ apt, onClose }: { apt: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')

  const { data: existing, isLoading } = useQuery({
    queryKey: ['review', apt.id],
    queryFn: () => getReview(apt.id),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: () => submitReview(apt.id, { rating, comment: comment || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review', apt.id] })
      qc.invalidateQueries({ queryKey: ['my-appointments'] })
      onClose()
    },
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{existing ? 'Değerlendirmeniz' : 'Randevuyu Değerlendir'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{apt.doctorName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : existing ? (
            <div className="space-y-3">
              <div className="flex gap-1 justify-center py-3">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={32} className={s <= existing.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                ))}
              </div>
              {existing.comment && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 italic">"{existing.comment}"</p>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">{dayjs(existing.createdAt).format('DD MMMM YYYY')} tarihinde gönderildi</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-1 justify-center py-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(s)} className="p-1 transition-transform hover:scale-110 active:scale-95">
                    <Star size={34} className={`transition-colors ${s <= (hovered || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-200'}`} />
                  </button>
                ))}
              </div>
              <p className="text-center text-sm font-semibold text-gray-600 h-5">{rating > 0 ? STAR_LABELS[rating] : ''}</p>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Deneyiminizi paylaşın... (isteğe bağlı)" rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                onClick={() => mutation.mutate()} disabled={rating === 0 || mutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-40"
              >
                {mutation.isPending ? 'Gönderiliyor...' : 'Değerlendirmeyi Gönder'}
              </button>
              {mutation.isError && <p className="text-red-500 text-xs text-center">Bir hata oluştu, tekrar deneyin.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AptSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-gray-100 rounded-lg w-36" />
          <div className="h-3 bg-gray-100 rounded-lg w-52" />
          <div className="h-3 bg-gray-100 rounded-lg w-24" />
        </div>
      </div>
    </div>
  )
}

export default function MyAppointmentsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming')
  const [reviewApt, setReviewApt] = useState<any | null>(null)

  useEffect(() => { document.title = 'Randevularım – BulutKlinik' }, [])

  const { data = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: getMyAppointments,
    staleTime: 60 * 1000,
  })

  const cancel = useMutation({
    mutationFn: (id: string) => updateStatus(id, 'Cancelled'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-appointments'] }),
  })

  const now = dayjs()
  const apts = data as any[]

  const counts = {
    upcoming:  apts.filter(a => a.status !== 'Cancelled' && dayjs(`${a.appointmentDate}T${a.startTime}`).isAfter(now)).length,
    all:       apts.length,
    past:      apts.filter(a => a.status === 'Completed' || (a.status !== 'Cancelled' && dayjs(`${a.appointmentDate}T${a.startTime}`).isBefore(now))).length,
    cancelled: apts.filter(a => a.status === 'Cancelled').length,
  }

  const filtered = apts.filter(a => {
    const dt = dayjs(`${a.appointmentDate}T${a.startTime}`)
    if (activeTab === 'upcoming')  return a.status !== 'Cancelled' && dt.isAfter(now)
    if (activeTab === 'past')      return a.status === 'Completed' || (a.status !== 'Cancelled' && dt.isBefore(now))
    if (activeTab === 'cancelled') return a.status === 'Cancelled'
    return true
  })

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'upcoming',  label: 'Yaklaşan' },
    { key: 'all',       label: 'Tümü' },
    { key: 'past',      label: 'Geçmiş' },
    { key: 'cancelled', label: 'İptal' },
  ]

  const bookBtn = (
    <Link to="/book" className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
      <Plus size={16} /> Randevu Al
    </Link>
  )

  return (
    <PatientLayout title="Randevularım" action={bookBtn}>
      <div className="max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 mb-5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 px-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-1 text-xs font-bold ${activeTab === t.key ? 'text-blue-600' : 'text-gray-400'}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <AptSkeleton key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-4">📅</div>
            <p className="font-semibold text-gray-700 mb-1">
              {activeTab === 'upcoming'  && 'Yaklaşan randevunuz yok'}
              {activeTab === 'past'      && 'Geçmiş randevu bulunamadı'}
              {activeTab === 'cancelled' && 'İptal edilen randevu yok'}
              {activeTab === 'all'       && 'Henüz randevunuz bulunmuyor'}
            </p>
            {activeTab === 'upcoming' && (
              <Link to="/book" className="inline-flex items-center gap-1 text-sm text-blue-600 font-semibold hover:underline mt-1">
                Randevu al <ChevronRight size={14} />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((apt: any) => {
              const dt = dayjs(`${apt.appointmentDate}T${apt.startTime}`)
              const isPast = dt.isBefore(now)
              const daysUntil = dt.diff(now, 'day')
              const cfg = STATUS_CFG[apt.status as keyof typeof STATUS_CFG] ?? { label: apt.status, cls: 'text-gray-600 bg-gray-50 border-gray-200' }

              return (
                <article key={apt.id} className={`bg-white rounded-2xl border p-4 transition-all ${apt.status === 'Cancelled' ? 'border-gray-100 opacity-55' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-start gap-3.5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${apt.status === 'Cancelled' ? 'bg-gray-100 text-gray-300' : 'bg-blue-100 text-blue-700'}`}>
                      {apt.doctorName?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="font-bold text-gray-900 text-sm">{apt.doctorName}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border flex-shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar size={11} />{dt.format('DD MMMM YYYY')}</span>
                        <span className="flex items-center gap-1"><Clock size={11} />{apt.startTime?.slice(0,5)} – {apt.endTime?.slice(0,5)}</span>
                        <span className="flex items-center gap-1">
                          {apt.type === 'Online' ? <Video size={11} /> : <MapPin size={11} />}
                          {apt.type === 'Online' ? 'Online' : 'Yüz Yüze'}
                        </span>
                      </div>
                      {!isPast && apt.status !== 'Cancelled' && (
                        <div className="mt-1.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysUntil === 0 ? 'bg-red-50 text-red-600' : daysUntil <= 3 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                            {daysUntil === 0 ? 'Bugün!' : daysUntil === 1 ? 'Yarın' : `${daysUntil} gün sonra`}
                          </span>
                        </div>
                      )}
                      {apt.notes && <p className="text-xs text-gray-400 mt-1.5 italic truncate">"{apt.notes}"</p>}
                      <div className="flex gap-2 mt-3">
                        {apt.status === 'Confirmed' && !isPast && (
                          <button onClick={() => cancel.mutate(apt.id)} disabled={cancel.isPending}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 hover:border-red-300 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-colors">
                            Randevuyu İptal Et
                          </button>
                        )}
                        {apt.status === 'Completed' && (
                          <button onClick={() => setReviewApt(apt)}
                            className="inline-flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold border border-amber-200 rounded-lg px-3 py-1.5 transition-colors">
                            <Star size={12} className="fill-amber-400 text-amber-400" /> Değerlendir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      {reviewApt && <ReviewModal apt={reviewApt} onClose={() => setReviewApt(null)} />}
    </PatientLayout>
  )
}
