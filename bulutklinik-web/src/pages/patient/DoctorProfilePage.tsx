import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doctorApi } from '../../services/doctorApi'
import PatientLayout from '../../components/patient/PatientLayout'
import { Star, Clock, CalendarPlus, MessageSquare, Stethoscope } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

const DAY_TR: Record<string, string> = {
  Monday: 'Pazartesi', Tuesday: 'Salı', Wednesday: 'Çarşamba',
  Thursday: 'Perşembe', Friday: 'Cuma', Saturday: 'Cumartesi', Sunday: 'Pazar',
}

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function StarRow({ value, max = 5, size = 18 }: { value: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}
        />
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gray-100" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-5 bg-gray-100 rounded-lg w-48" />
            <div className="h-4 bg-gray-100 rounded-lg w-32" />
            <div className="h-4 bg-gray-100 rounded-lg w-24" />
          </div>
        </div>
      </div>
      {[1, 2].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />)}
    </div>
  )
}

export default function DoctorProfilePage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor-profile', doctorId],
    queryFn: () => doctorApi.getProfile(doctorId!),
    enabled: !!doctorId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (doctor) document.title = `${doctor.title} ${doctor.fullName} – Medica.AI`
    else document.title = 'Doktor Profili – Medica.AI'
  }, [doctor])

  if (isLoading) return <PatientLayout title="Doktor Profili"><ProfileSkeleton /></PatientLayout>

  if (!doctor) return (
    <PatientLayout title="Doktor Profili">
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-md">
        <p className="text-gray-500 font-medium">Doktor bulunamadı.</p>
      </div>
    </PatientLayout>
  )

  const sortedSchedules = [...(doctor.schedules ?? [])].sort(
    (a: any, b: any) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  )

  return (
    <PatientLayout title="Doktor Profili">
      <div className="max-w-2xl space-y-4">

        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 text-3xl font-bold flex-shrink-0 relative">
              {doctor.avatarUrl
                ? <img src={doctor.avatarUrl} alt={doctor.fullName} className="w-20 h-20 rounded-2xl object-cover" />
                : doctor.fullName?.[0] ?? '?'
              }
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <Stethoscope size={12} className="text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{doctor.title} {doctor.fullName}</h1>
              <p className="text-blue-600 font-semibold text-sm mt-0.5">{doctor.specialty}</p>

              {doctor.avgRating != null ? (
                <div className="flex items-center gap-2 mt-2">
                  <StarRow value={doctor.avgRating} size={16} />
                  <span className="text-sm font-bold text-gray-800">{doctor.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({doctor.reviewCount} değerlendirme)</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Henüz değerlendirme yok</p>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate(`/book?doctorId=${doctorId}`)}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors shadow-sm shadow-blue-200"
          >
            <CalendarPlus size={18} />
            Randevu Al
          </button>
        </div>

        {/* Working schedule */}
        {sortedSchedules.length > 0 && (
          <section aria-labelledby="schedule-title" className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-blue-600" />
              </div>
              <h2 id="schedule-title" className="font-bold text-gray-900">Çalışma Saatleri</h2>
            </div>
            <div className="space-y-1">
              {sortedSchedules.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-semibold text-gray-700">{DAY_TR[s.dayOfWeek] ?? s.dayOfWeek}</span>
                  <span className="text-sm text-gray-500 font-mono bg-gray-50 px-3 py-1 rounded-lg">
                    {s.startTime?.slice(0, 5)} – {s.endTime?.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        <section aria-labelledby="reviews-title" className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={16} className="text-amber-600" />
              </div>
              <h2 id="reviews-title" className="font-bold text-gray-900">Değerlendirmeler</h2>
            </div>
            {doctor.reviewCount > 0 && (
              <span className="text-xs text-gray-400 font-medium">{doctor.reviewCount} değerlendirme</span>
            )}
          </div>

          {(!doctor.reviews || doctor.reviews.length === 0) ? (
            <div className="text-center py-6">
              <Star size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Henüz değerlendirme bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {doctor.reviews.map((r: any, i: number) => (
                <div key={i} className={`${i < doctor.reviews.length - 1 ? 'border-b border-gray-50 pb-4' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <StarRow value={r.rating} size={15} />
                    <span className="text-xs text-gray-400">{dayjs(r.createdAt).format('DD MMM YYYY')}</span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3.5 py-2.5 italic">
                      "{r.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </PatientLayout>
  )
}
