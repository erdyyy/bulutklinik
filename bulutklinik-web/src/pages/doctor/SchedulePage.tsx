import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSchedules, upsertSchedule, getLeaves, addLeave } from '../../services/scheduleApi'
import { useAuthStore } from '../../store/authStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import { CheckCircle2, Plus, Clock, CalendarOff } from 'lucide-react'
import dayjs from 'dayjs'

const DAYS = [
  { value: 'Monday',    label: 'Pazartesi', short: 'Pzt' },
  { value: 'Tuesday',   label: 'Salı',      short: 'Sal' },
  { value: 'Wednesday', label: 'Çarşamba',  short: 'Çar' },
  { value: 'Thursday',  label: 'Perşembe',  short: 'Per' },
  { value: 'Friday',    label: 'Cuma',      short: 'Cum' },
  { value: 'Saturday',  label: 'Cumartesi', short: 'Cmt' },
  { value: 'Sunday',    label: 'Pazar',     short: 'Paz' },
]

export default function SchedulePage() {
  const { userId } = useAuthStore()
  const qc = useQueryClient()
  const [day, setDay] = useState('Monday')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [leaveDate, setLeaveDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { document.title = 'Çalışma Saatleri – BulutKlinik' }, [])

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', userId],
    queryFn: () => getSchedules(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', userId],
    queryFn: () => getLeaves(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  const saveSchedule = useMutation({
    mutationFn: () => upsertSchedule(userId!, {
      dayOfWeek: day,
      startTime: `${start}:00`,
      endTime: `${end}:00`,
      appointmentDurationMinutes: 30,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); showSuccess('Takvim kaydedildi!') },
  })

  const addLeaveDay = useMutation({
    mutationFn: () => addLeave(userId!, { leaveDate, isFullDay: true, reason: 'İzin' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); showSuccess('İzin günü eklendi!') },
  })

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  return (
    <DoctorLayout title="Çalışma Saatleri">
      <div className="max-w-3xl space-y-5">

        {/* Success toast */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-medium">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* Active days overview */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Aktif Günler</h2>
          {(schedules as any[]).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <Clock size={28} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Henüz çalışma günü eklenmedi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DAYS.map(d => {
                const sch = (schedules as any[]).find((s: any) => s.dayOfWeek === d.value)
                if (!sch) return null
                return (
                  <div key={d.value} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{d.label}</p>
                      <p className="text-xs text-gray-400">
                        {sch.startTime.slice(0, 5)} — {sch.endTime.slice(0, 5)} · {sch.appointmentDurationMinutes} dk
                      </p>
                    </div>
                  </div>
                )
              }).filter(Boolean)}
            </div>
          )}
        </section>

        {/* Add/update day */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Gün Ekle / Güncelle</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Gün</label>
                <select value={day} onChange={e => setDay(e.target.value)} className={inputCls}>
                  {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Başlangıç</label>
                <input type="time" value={start} onChange={e => setStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Bitiş</label>
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
            <button
              onClick={() => saveSchedule.mutate()}
              disabled={saveSchedule.isPending}
              className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle2 size={14} />
              {saveSchedule.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </section>

        {/* Leave days */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">İzin Günleri</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            {(leaves as any[]).length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">İzin günü eklenmemiş.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {(leaves as any[]).map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <CalendarOff size={14} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{dayjs(l.leaveDate).format('DD MMMM YYYY')}</p>
                      <p className="text-xs text-gray-400">{l.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 items-end pt-2 border-t border-gray-50">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1.5">İzin Tarihi</label>
                <input
                  type="date"
                  value={leaveDate}
                  min={dayjs().format('YYYY-MM-DD')}
                  onChange={e => setLeaveDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                onClick={() => addLeaveDay.mutate()}
                disabled={addLeaveDay.isPending}
                className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                <Plus size={14} />
                {addLeaveDay.isPending ? 'Ekleniyor...' : 'İzin Ekle'}
              </button>
            </div>
          </div>
        </section>

      </div>
    </DoctorLayout>
  )
}
