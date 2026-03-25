import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getDoctorAppointments } from '../../services/appointmentApi'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import { Search, ChevronRight, Users } from 'lucide-react'
import dayjs from 'dayjs'

export default function PatientListPage() {
  const { userId } = useAuthStore()
  const [search, setSearch] = useState('')

  useEffect(() => { document.title = 'Hastalarım – Medica.AI' }, [])

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // Build unique patient map
  const patientMap = new Map<string, { id: string; email: string; lastDate: string; count: number; completedCount: number }>()
  for (const apt of appointments as any[]) {
    const existing = patientMap.get(apt.patientId)
    if (!existing) {
      patientMap.set(apt.patientId, {
        id: apt.patientId,
        email: apt.patientEmail,
        lastDate: apt.appointmentDate,
        count: 1,
        completedCount: apt.status === 'Completed' ? 1 : 0,
      })
    } else {
      existing.count++
      if (apt.status === 'Completed') existing.completedCount++
      if (apt.appointmentDate > existing.lastDate) existing.lastDate = apt.appointmentDate
    }
  }

  const patients = Array.from(patientMap.values())
    .filter(p => p.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))

  return (
    <DoctorLayout title="Hastalarım">
      <div className="max-w-3xl">

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="E-posta ile ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
          />
        </div>

        {/* Stats bar */}
        {!isLoading && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-gray-800">{patients.length} hasta</span>
            {search && (
              <span className="text-xs text-gray-400">"{search}" için sonuçlar</span>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 animate-pulse bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && patients.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700">
              {search ? 'Eşleşen hasta bulunamadı' : 'Henüz hasta bulunmuyor'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Farklı bir arama terimi deneyin' : 'Randevular oluşturulduğunda hastalar burada görünecek'}
            </p>
          </div>
        )}

        {/* Patient list */}
        <div className="space-y-2.5">
          {patients.map(p => {
            const initials = p.email.charAt(0).toUpperCase()
            const colors = [
              'from-teal-400 to-emerald-500',
              'from-blue-400 to-indigo-500',
              'from-violet-400 to-purple-500',
              'from-orange-400 to-red-400',
            ]
            const colorIdx = p.id.charCodeAt(0) % colors.length

            return (
              <Link
                key={p.id}
                to={`/doctor/patients/${p.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-teal-200 hover:shadow-sm transition-all group"
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{p.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Son: {dayjs(p.lastDate).format('DD MMM YYYY')}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-600">{p.count}</p>
                    <p className="text-[10px] text-gray-400">randevu</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 group-hover:text-teal-400 transition-colors"
                  />
                </div>
              </Link>
            )
          })}
        </div>

      </div>
    </DoctorLayout>
  )
}
