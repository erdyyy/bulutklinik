import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '../../services/appointmentApi';
import { StatusBadge } from '../../components/shared/StatusBadge';
import dayjs from 'dayjs';

export function MyAppointmentsPage() {
  const qc = useQueryClient();
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: appointmentApi.getMyAppointments,
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      appointmentApi.updateStatus(id, { status: 'Cancelled', cancellationReason: 'Hasta tarafından iptal edildi.' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-appointments'] }),
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Randevularım</h1>
      {appointments.length === 0 && <p className="text-gray-500">Henüz randevunuz yok.</p>}
      <div className="space-y-3">
        {appointments.map((a: any) => (
          <div key={a.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{a.doctorName}</p>
              <p className="text-sm text-gray-500">
                {dayjs(a.appointmentDate).format('DD.MM.YYYY')} — {a.startTime.slice(0, 5)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={a.status} />
              {a.status !== 'Cancelled' && a.status !== 'Completed' && (
                <button
                  onClick={() => cancel.mutate(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  İptal Et
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
