import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const daysTr = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

export function ScheduleSettingsPage() {
  const userId = useAuthStore(s => s.userId)!;
  const qc = useQueryClient();
  const [form, setForm] = useState({
    dayOfWeek: 'Monday', startTime: '09:00:00', endTime: '17:00:00', appointmentDurationMinutes: 15
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', userId],
    queryFn: () => api.get(`/api/doctors/${userId}/schedules`).then(r => r.data),
  });

  const upsert = useMutation({
    mutationFn: () => api.put(`/api/doctors/${userId}/schedules`, form).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Çalışma Saati Ayarları</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Gün</label>
            <select value={form.dayOfWeek} onChange={e => setForm(f => ({...f, dayOfWeek: e.target.value}))}
              className="w-full border rounded px-2 py-1 text-sm">
              {days.map((d, i) => <option key={d} value={d}>{daysTr[i]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Süre (dk)</label>
            <input type="number" value={form.appointmentDurationMinutes}
              onChange={e => setForm(f => ({...f, appointmentDurationMinutes: +e.target.value}))}
              className="w-full border rounded px-2 py-1 text-sm" min={5} max={120} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Başlangıç</label>
            <input type="time" value={form.startTime.slice(0,5)}
              onChange={e => setForm(f => ({...f, startTime: e.target.value+':00'}))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Bitiş</label>
            <input type="time" value={form.endTime.slice(0,5)}
              onChange={e => setForm(f => ({...f, endTime: e.target.value+':00'}))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
        <button onClick={() => upsert.mutate()}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">
          Kaydet
        </button>
      </div>

      <div className="space-y-2">
        {schedules.map((s: any) => (
          <div key={s.id} className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center text-sm">
            <span>{daysTr[days.indexOf(s.dayOfWeek)] ?? s.dayOfWeek}</span>
            <span className="text-gray-500">{s.startTime?.slice(0,5)} — {s.endTime?.slice(0,5)} ({s.appointmentDurationMinutes} dk)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
