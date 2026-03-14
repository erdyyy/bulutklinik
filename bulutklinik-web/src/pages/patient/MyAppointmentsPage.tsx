import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyAppointments, updateStatus } from '../../services/appointmentApi'
import StatusBadge from '../../components/shared/StatusBadge'
import Navbar from '../../components/shared/Navbar'
import dayjs from 'dayjs'

export default function MyAppointmentsPage() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['my-appointments'], queryFn: getMyAppointments })

  const cancel = useMutation({
    mutationFn: (id: string) => updateStatus(id, 'Cancelled'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-appointments'] }),
  })

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Randevularım</h1>

        {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
        {!isLoading && data.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📅</div>
            <p>Henüz randevunuz bulunmuyor.</p>
          </div>
        )}

        <div className="space-y-3">
          {data.map((apt: any) => (
            <div key={apt.id} className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{apt.doctorName}</p>
                <p className="text-sm text-gray-500">
                  {dayjs(apt.appointmentDate).format('DD MMMM YYYY')} — {apt.startTime.slice(0, 5)} - {apt.endTime.slice(0, 5)}
                </p>
                {apt.notes && <p className="text-xs text-gray-400 mt-1">"{apt.notes}"</p>}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={apt.status} />
                {apt.status === 'Confirmed' && (
                  <button
                    onClick={() => cancel.mutate(apt.id)}
                    disabled={cancel.isPending}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-300 rounded px-2 py-1"
                  >
                    İptal Et
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
