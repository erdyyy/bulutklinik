import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentApi } from '../../services/appointmentApi';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge } from '../../components/shared/StatusBadge';
import dayjs from 'dayjs';

export function CalendarPage() {
  const userId = useAuthStore(s => s.userId)!;
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments', userId, date],
    queryFn: () => appointmentApi.getDoctorAppointments(userId, date),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Randevu Takvimi</h1>
      <div className="mb-4">
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
      {!isLoading && appointments.length === 0 && <p className="text-gray-500">Bu tarihte randevu yok.</p>}
      <div className="space-y-2">
        {appointments.map((a: any) => (
          <div key={a.id} className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center">
            <div>
              <p className="font-medium">{a.patientEmail ?? a.patientId}</p>
              <p className="text-sm text-gray-500">{a.startTime?.slice(0, 5)} — {a.endTime?.slice(0, 5)}</p>
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
