import { useQuery } from '@tanstack/react-query'
import { getDoctorAppointments } from '../../services/appointmentApi'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/shared/Navbar'
import StatusBadge from '../../components/shared/StatusBadge'
import dayjs from 'dayjs'

export default function DashboardPage() {
  const { userId } = useAuthStore()
  const today = dayjs().format('YYYY-MM-DD')

  const { data: allApts = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
  })

  const todayApts = allApts.filter((a: any) => a.appointmentDate === today)
  const confirmed  = allApts.filter((a: any) => a.status === 'Confirmed').length
  const cancelled  = allApts.filter((a: any) => a.status === 'Cancelled').length
  const upcoming   = allApts.filter((a: any) => a.appointmentDate >= today && a.status === 'Confirmed')

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* KPI Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Bugünkü Randevular", value: todayApts.length, color: "blue", icon: "📅" },
            { label: "Onaylı Randevular", value: confirmed, color: "green", icon: "✅" },
            { label: "İptal Edilen", value: cancelled, color: "red", icon: "❌" },
            { label: "Toplam", value: allApts.length, color: "purple", icon: "📊" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm border p-4 text-center">
              <div className="text-2xl mb-1">{kpi.icon}</div>
              <div className="text-3xl font-bold text-gray-800">{kpi.value}</div>
              <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Yaklaşan Randevular */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Yaklaşan Randevular</h2>
          {isLoading && <p className="text-sm text-gray-400">Yükleniyor...</p>}
          {!isLoading && upcoming.length === 0 && (
            <p className="text-sm text-gray-400">Yaklaşan onaylı randevu yok.</p>
          )}
          <div className="space-y-2">
            {upcoming.slice(0, 8).map((apt: any) => (
              <div key={apt.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {dayjs(apt.appointmentDate).format('DD MMM')} — {apt.startTime.slice(0, 5)}
                  </p>
                  {apt.notes && <p className="text-xs text-gray-400">{apt.notes}</p>}
                </div>
                <StatusBadge status={apt.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
