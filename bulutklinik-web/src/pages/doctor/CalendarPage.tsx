import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDoctorAppointments, updateStatus } from '../../services/appointmentApi'
import { useAuthStore } from '../../store/authStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

const STATUS_CFG = {
  Confirmed: { dot: 'bg-emerald-500', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  Pending:   { dot: 'bg-amber-400',   cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  Cancelled: { dot: 'bg-red-400',     cls: 'border-red-200 bg-red-50 text-red-700 opacity-60' },
  Completed: { dot: 'bg-blue-400',    cls: 'border-blue-200 bg-blue-50 text-blue-800' },
} as const

export default function CalendarPage() {
  const { userId } = useAuthStore()
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'))

  useEffect(() => { document.title = 'Takvim – BulutKlinik' }, [])

  const { data: apts = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  const complete = useMutation({
    mutationFn: (id: string) => updateStatus(id, 'Completed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-appointments'] }),
  })

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const todayStr = dayjs().format('YYYY-MM-DD')
  const weekLabel = `${weekStart.format('DD MMM')} – ${weekStart.add(6, 'day').format('DD MMM YYYY')}`

  const navAction = (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}
        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        aria-label="Önceki hafta"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => setWeekStart(dayjs().startOf('week').add(1, 'day'))}
        className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Bu Hafta
      </button>
      <button
        onClick={() => setWeekStart(weekStart.add(7, 'day'))}
        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        aria-label="Sonraki hafta"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )

  return (
    <DoctorLayout title={`Takvim · ${weekLabel}`} action={navAction}>
      <div className="space-y-4">

        {isLoading && (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {days.map(day => {
              const dateStr = day.format('YYYY-MM-DD')
              const dayApts = (apts as any[])
                .filter((a: any) => a.appointmentDate === dateStr)
                .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr

              return (
                <div
                  key={dateStr}
                  className={`rounded-2xl border p-3 min-h-[160px] transition-all ${
                    isToday
                      ? 'border-teal-300 bg-teal-50/50 shadow-sm shadow-teal-100'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  {/* Day header */}
                  <div className="mb-3">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-teal-600' : isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                      {day.format('ddd')}
                    </p>
                    <p className={`text-lg font-bold leading-tight ${isToday ? 'text-teal-700' : isPast ? 'text-gray-300' : 'text-gray-800'}`}>
                      {day.format('D')}
                    </p>
                    {dayApts.length > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-teal-200 text-teal-800' : 'bg-gray-100 text-gray-500'}`}>
                        {dayApts.length}
                      </span>
                    )}
                  </div>

                  {/* Appointments */}
                  <div className="space-y-1.5">
                    {dayApts.map((a: any) => {
                      const cfg = STATUS_CFG[a.status as keyof typeof STATUS_CFG]
                        ?? { dot: 'bg-gray-400', cls: 'border-gray-200 bg-gray-50 text-gray-700' }
                      const canComplete = a.status === 'Confirmed'
                      return (
                        <button
                          key={a.id}
                          onClick={() => canComplete && complete.mutate(a.id)}
                          disabled={complete.isPending || !canComplete}
                          title={canComplete ? 'Tamamlandı olarak işaretle' : ''}
                          className={`w-full text-left text-xs rounded-xl px-2.5 py-1.5 border transition-all ${cfg.cls} ${canComplete ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <span className="font-semibold">{a.startTime.slice(0, 5)}</span>
                          </div>
                          <p className="truncate mt-0.5 text-[10px] opacity-70">
                            {a.patientEmail?.split('@')[0] ?? '—'}
                          </p>
                        </button>
                      )
                    })}
                    {dayApts.length === 0 && (
                      <p className={`text-[10px] text-center mt-4 ${isPast ? 'text-gray-200' : 'text-gray-300'}`}>
                        Boş
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 pt-2">
          {Object.entries(STATUS_CFG).map(([status, cfg]) => {
            const labels: Record<string, string> = {
              Confirmed: 'Onaylı', Pending: 'Beklemede', Cancelled: 'İptal', Completed: 'Tamamlandı',
            }
            return (
              <div key={status} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-xs text-gray-500">{labels[status]}</span>
              </div>
            )
          })}
          <span className="text-xs text-gray-400 ml-auto italic">Onaylı randevuya tıkla → Tamamlandı</span>
        </div>
      </div>
    </DoctorLayout>
  )
}
