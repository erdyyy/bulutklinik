import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSchedules, upsertSchedule, getLeaves, addLeave } from '../../services/scheduleApi'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/shared/Navbar'
import dayjs from 'dayjs'

const DAYS = [
  { value: 'Monday',    label: 'Pazartesi' },
  { value: 'Tuesday',   label: 'Salı' },
  { value: 'Wednesday', label: 'Çarşamba' },
  { value: 'Thursday',  label: 'Perşembe' },
  { value: 'Friday',    label: 'Cuma' },
  { value: 'Saturday',  label: 'Cumartesi' },
  { value: 'Sunday',    label: 'Pazar' },
]

export default function SchedulePage() {
  const { userId } = useAuthStore()
  const qc = useQueryClient()

  const [day, setDay] = useState('Monday')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [leaveDate, setLeaveDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [success, setSuccess] = useState('')

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', userId],
    queryFn: () => getSchedules(userId!),
    enabled: !!userId,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', userId],
    queryFn: () => getLeaves(userId!),
    enabled: !!userId,
  })

  const saveSchedule = useMutation({
    mutationFn: () => upsertSchedule(userId!, {
      dayOfWeek: day,
      startTime: `${start}:00`,
      endTime: `${end}:00`,
      appointmentDurationMinutes: 30,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      setSuccess('Takvim kaydedildi!')
      setTimeout(() => setSuccess(''), 2000)
    },
  })

  const addLeaveDay = useMutation({
    mutationFn: () => addLeave(userId!, { leaveDate, isFullDay: true, reason: 'İzin' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      setSuccess('İzin eklendi!')
      setTimeout(() => setSuccess(''), 2000)
    },
  })

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Çalışma Saatleri</h1>

        {success && (
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">{success}</div>
        )}

        {/* Mevcut Takvim */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Aktif Günler</h2>
          {schedules.length === 0 && <p className="text-sm text-gray-400">Henüz çalışma günü eklenmedi.</p>}
          <div className="space-y-2">
            {schedules.map((s: any) => (
              <div key={s.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span className="font-medium text-gray-700">
                  {DAYS.find(d => d.value === s.dayOfWeek)?.label ?? s.dayOfWeek}
                </span>
                <span className="text-gray-500">{s.startTime.slice(0,5)} — {s.endTime.slice(0,5)} · {s.appointmentDurationMinutes} dk</span>
              </div>
            ))}
          </div>
        </div>

        {/* Yeni Gün Ekle */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Gün Ekle / Güncelle</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gün</label>
              <select
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm"
              >
                {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Başlangıç</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bitiş</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <button
            onClick={() => saveSchedule.mutate()}
            disabled={saveSchedule.isPending}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>

        {/* İzin Günleri */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-3">İzin Günleri</h2>
          {leaves.length === 0 && <p className="text-sm text-gray-400 mb-3">İzin günü yok.</p>}
          <div className="space-y-1 mb-3">
            {leaves.map((l: any) => (
              <p key={l.id} className="text-sm text-gray-600">📅 {l.leaveDate} — {l.reason}</p>
            ))}
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Tarih</label>
              <input type="date" value={leaveDate} min={dayjs().format('YYYY-MM-DD')}
                onChange={e => setLeaveDate(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm" />
            </div>
            <button
              onClick={() => addLeaveDay.mutate()}
              disabled={addLeaveDay.isPending}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              İzin Ekle
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
