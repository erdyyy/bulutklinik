import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSlots, createAppointment } from '../../services/appointmentApi'
import { doctorApi } from '../../services/doctorApi'
import PatientLayout from '../../components/patient/PatientLayout'
import { Check, Star, Monitor, Building2, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
}

export default function BookAppointmentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('doctorId')

  useEffect(() => { document.title = 'Randevu Al – BulutKlinik' }, [])

  const [step, setStep] = useState<1 | 2 | 3>(preselectedId ? 2 : 1)
  const [selectedDoctorId, setSelectedDoctorId] = useState(preselectedId ?? '')
  const [type, setType] = useState<'InPerson' | 'Online'>('InPerson')
  const [date, setDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorApi.getAll,
    staleTime: 5 * 60 * 1000,
  })

  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', selectedDoctorId, date],
    queryFn: () => getSlots(selectedDoctorId, date),
    enabled: !!selectedDoctorId && !!date && step === 3,
  })

  const slots = (slotsData?.slots ?? slotsData ?? []) as any[]
  const available = slots.filter((s: any) => s.isAvailable)
  const selectedDoctor = (doctors as any[]).find((d: any) => d.id === selectedDoctorId)

  const book = useMutation({
    mutationFn: () => createAppointment({ doctorId: selectedDoctorId, appointmentDate: date, startTime: selectedSlot, type, notes }),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => navigate('/my-appointments'), 2000)
    },
  })

  if (success) {
    return (
      <PatientLayout title="Randevu Al">
        <div className="max-w-md mx-auto mt-16 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Randevunuz Oluşturuldu!</h2>
          <p className="text-gray-500 mb-1">{selectedDoctor?.title} {selectedDoctor?.fullName}</p>
          <p className="text-gray-500 text-sm">
            {dayjs(date).format('DD MMMM YYYY')} · {selectedSlot?.slice(0, 5)}
          </p>
          <p className="text-xs text-gray-400 mt-4">Randevularım sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </PatientLayout>
    )
  }

  const STEPS = [
    { n: 1, label: 'Doktor Seç' },
    { n: 2, label: 'Tarih & Tip' },
    { n: 3, label: 'Saat & Onayla' },
  ]

  return (
    <PatientLayout title="Randevu Al">
      <div className="max-w-2xl mx-auto">

        {/* Stepper */}
        <nav aria-label="Adımlar" className="flex items-center gap-0 mb-8">
          {STEPS.map(({ n, label }, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > n ? 'bg-blue-600 text-white' :
                  step === n ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {step > n ? <Check size={14} /> : n}
                </div>
                <p className={`text-xs mt-1.5 font-medium hidden sm:block ${step === n ? 'text-blue-600' : step > n ? 'text-gray-600' : 'text-gray-400'}`}>{label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded ${step > n ? 'bg-blue-600' : 'bg-gray-100'}`} />
              )}
            </div>
          ))}
        </nav>

        {/* Step 1: Doctor selection */}
        {step === 1 && (
          <section aria-labelledby="step1-title">
            <h2 id="step1-title" className="text-lg font-bold text-gray-900 mb-4">Doktor Seç</h2>
            {loadingDoctors ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (doctors as any[]).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-gray-400">Aktif doktor bulunamadı.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(doctors as any[]).map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDoctorId(d.id); setSelectedSlot(''); setStep(2) }}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all hover:shadow-sm ${
                      selectedDoctorId === d.id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${selectedDoctorId === d.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {d.fullName?.[0] ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${selectedDoctorId === d.id ? 'text-blue-700' : 'text-gray-900'}`}>
                        {d.title} {d.fullName}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{d.specialty}</p>
                      {d.avgRating != null && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star size={11} className="text-yellow-400 fill-yellow-400" />
                          <span className="text-xs text-gray-500">{d.avgRating.toFixed(1)} ({d.reviewCount})</span>
                        </div>
                      )}
                    </div>
                    {selectedDoctorId === d.id && <Check size={18} className="text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 2: Date + Type */}
        {step === 2 && selectedDoctor && (
          <section aria-labelledby="step2-title">
            <h2 id="step2-title" className="text-lg font-bold text-gray-900 mb-4">Tarih ve Randevu Tipi</h2>

            {/* Selected doctor summary */}
            <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                {selectedDoctor.fullName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-blue-900 text-sm">{selectedDoctor.title} {selectedDoctor.fullName}</p>
                <p className="text-xs text-blue-600">{selectedDoctor.specialty}</p>
              </div>
              <Link to={`/doctor/${selectedDoctorId}/profile`} className="text-xs text-blue-600 font-semibold hover:underline flex-shrink-0">
                Profil
              </Link>
            </div>

            {/* Type */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-700 mb-2">Randevu Tipi</p>
              <div className="grid grid-cols-2 gap-2">
                {([['InPerson', 'Yüz Yüze', Building2], ['Online', 'Online', Monitor]] as const).map(([val, lbl, Icon]) => (
                  <button
                    key={val}
                    onClick={() => setType(val)}
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl border font-semibold text-sm transition-all ${
                      type === val
                        ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={18} />
                    {lbl}
                    {type === val && <Check size={15} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="mb-6">
              <label htmlFor="date-input" className="block text-sm font-bold text-gray-700 mb-2">Tarih Seç</label>
              <input
                id="date-input"
                type="date"
                value={date}
                min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
                onChange={e => { setDate(e.target.value); setSelectedSlot('') }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              {date && <p className="text-xs text-gray-400 mt-1.5 capitalize">{dayjs(date).format('DD MMMM YYYY, dddd')}</p>}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label htmlFor="notes-input" className="block text-sm font-bold text-gray-700 mb-2">
                Şikayet / Not <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
              </label>
              <textarea
                id="notes-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Şikayetinizi kısaca açıklayın..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={16} /> Geri
              </button>
              <button onClick={() => setStep(3)} className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
                Saat Seç <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Slot selection + confirm */}
        {step === 3 && selectedDoctor && (
          <section aria-labelledby="step3-title">
            <h2 id="step3-title" className="text-lg font-bold text-gray-900 mb-4">Saat Seç ve Onayla</h2>

            {/* Summary */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Doktor</span>
                <span className="font-semibold text-gray-900">{selectedDoctor.title} {selectedDoctor.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tarih</span>
                <span className="font-semibold text-gray-900 capitalize">{dayjs(date).format('DD MMMM YYYY')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tip</span>
                <span className="font-semibold text-gray-900">{type === 'Online' ? '💻 Online' : '🏥 Yüz Yüze'}</span>
              </div>
              {selectedSlot && (
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-500">Saat</span>
                  <span className="font-bold text-blue-600">{selectedSlot.slice(0, 5)}</span>
                </div>
              )}
            </div>

            {/* Slots */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-700 mb-3">
                Müsait Saatler
                {available.length > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">{available.length} saat müsait</span>}
              </p>
              {loadingSlots ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-amber-700 text-sm font-medium">Bu tarihte müsait saat bulunamadı.</p>
                  <button onClick={() => setStep(2)} className="text-xs text-amber-600 underline mt-1">Farklı tarih seç</button>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((s: any) => (
                    <button
                      key={s.startTime}
                      disabled={!s.isAvailable}
                      onClick={() => setSelectedSlot(s.startTime)}
                      className={`text-sm py-2 rounded-xl font-semibold transition-all ${
                        !s.isAvailable ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' :
                        selectedSlot === s.startTime ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' :
                        'bg-white text-gray-700 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {s.startTime?.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {book.isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-600 text-sm font-medium">
                  {(book.error as any)?.response?.data?.message ?? 'Randevu oluşturulamadı. Lütfen tekrar deneyin.'}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={16} /> Geri
              </button>
              <button
                onClick={() => book.mutate()}
                disabled={!selectedSlot || book.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40"
              >
                {book.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Oluşturuluyor...</>
                ) : (
                  <><Check size={16} /> Randevuyu Onayla</>
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    </PatientLayout>
  )
}
