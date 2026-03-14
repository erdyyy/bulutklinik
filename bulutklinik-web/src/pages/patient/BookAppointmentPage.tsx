import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSlots, createAppointment } from '../../services/appointmentApi'
import Navbar from '../../components/shared/Navbar'
import dayjs from 'dayjs'
const DOCTOR_ID = 'c0e0747c-57c6-42e0-9b11-096dec43ec52' // demo

export default function BookAppointmentPage() {
  const [date, setDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['slots', DOCTOR_ID, date],
    queryFn: () => getSlots(DOCTOR_ID, date),
    enabled: !!date,
  })

  const slots = slotsData?.slots ?? slotsData ?? []

  const book = useMutation({
    mutationFn: () =>
      createAppointment({
        doctorId: DOCTOR_ID,
        appointmentDate: date,
        startTime: selectedSlot,
        type: 'InPerson',
        notes,
      }),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => navigate('/my-appointments'), 1500)
    },
  })

  return (
    <>
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Randevu Al</h1>

        {success && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4">
            ✅ Randevunuz oluşturuldu! Yönlendiriliyorsunuz...
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Seç</label>
            <input
              type="date"
              value={date}
              min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
              onChange={(e) => { setDate(e.target.value); setSelectedSlot('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Saat Seç</label>
            {isLoading && <p className="text-sm text-gray-400">Slotlar yükleniyor...</p>}
            {!isLoading && slots.length === 0 && (
              <p className="text-sm text-gray-400">Bu tarihte müsait saat yok.</p>
            )}
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s: any) => (
                <button
                  key={s.startTime}
                  disabled={!s.isAvailable}
                  onClick={() => setSelectedSlot(s.startTime)}
                  className={`text-sm py-2 px-1 rounded-lg border font-medium transition
                    ${!s.isAvailable ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-100' :
                      selectedSlot === s.startTime
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                >
                  {s.startTime.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şikayet / Not (opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Şikayetinizi kısaca yazın..."
            />
          </div>

          {book.isError && (
            <p className="text-sm text-red-500">
              {(book.error as any)?.response?.data?.message ?? 'Randevu oluşturulamadı.'}
            </p>
          )}

          <button
            onClick={() => book.mutate()}
            disabled={!selectedSlot || book.isPending}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition"
          >
            {book.isPending ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
          </button>
        </div>
      </div>
    </>
  )
}
