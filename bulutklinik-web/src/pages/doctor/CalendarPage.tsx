import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDoctorAppointments, updateStatus } from '../../services/appointmentApi'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/shared/Navbar'
import StatusBadge from '../../components/shared/StatusBadge'
import dayjs from 'dayjs'

export default function CalendarPage() {
  const { userId } = useAuthStore()
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'))
  const qc = useQueryClient()

  const { data: apts = [] } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
  })

  const complete = useMutation({
    mutationFn: (id: string) => updateStatus(id, 'Completed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-appointments'] }),
  })

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Haftalık Takvim</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
            >← Önceki</button>
            <button
              onClick={() => setWeekStart(dayjs().startOf('week').add(1, 'day'))}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
            >Bu Hafta</button>
            <button
              onClick={() => setWeekStart(weekStart.add(7, 'day'))}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
            >Sonraki →</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateStr = day.format('YYYY-MM-DD')
            const dayApts = apts.filter((a: any) => a.appointmentDate === dateStr)
            const isToday = dateStr === dayjs().format('YYYY-MM-DD')

            return (
              <div
                key={dateStr}
                className={`rounded-xl border p-3 min-h-[120px] ${isToday ? 'border-blue-400 bg-blue-50' : 'bg-white'}`}
              >
                <p className={`text-xs font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                  {day.format('ddd DD/MM')}
                </p>
                <div className="space-y-1">
                  {dayApts.map((a: any) => (
                    <div
                      key={a.id}
                      className="text-xs bg-white border rounded p-1 cursor-pointer hover:bg-gray-50"
                      onClick={() => a.status === 'Confirmed' && complete.mutate(a.id)}
                      title={a.status === 'Confirmed' ? 'Tamamlandı olarak işaretle' : ''}
                    >
                      <span className="font-medium">{a.startTime.slice(0, 5)}</span>
                      <span className="ml-1 text-gray-400">{a.notes?.slice(0, 12) || '—'}</span>
                      <div className="mt-0.5"><StatusBadge status={a.status} /></div>
                    </div>
                  ))}
                  {dayApts.length === 0 && (
                    <p className="text-xs text-gray-300">Boş</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
