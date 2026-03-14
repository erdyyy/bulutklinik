import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getDoctorAppointments } from '../../services/appointmentApi'
import Navbar from '../../components/shared/Navbar'

export default function PatientListPage() {
  const { userId } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
  })

  // Benzersiz hastaları çıkar
  const patientMap = new Map<string, { id: string; email: string; lastDate: string; count: number }>()
  for (const apt of appointments as any[]) {
    const existing = patientMap.get(apt.patientId)
    if (!existing) {
      patientMap.set(apt.patientId, {
        id: apt.patientId,
        email: apt.patientEmail,
        lastDate: apt.appointmentDate,
        count: 1,
      })
    } else {
      existing.count++
      if (apt.appointmentDate > existing.lastDate) {
        existing.lastDate = apt.appointmentDate
      }
    }
  }

  const patients = Array.from(patientMap.values()).filter(p =>
    p.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Hastalarım</h1>

        <div className="mb-5">
          <input
            type="text"
            placeholder="E-posta ile ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
        {!isLoading && patients.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            Henüz hasta bulunmuyor.
          </div>
        )}

        <div className="space-y-3">
          {patients.map(p => (
            <Link
              key={p.id}
              to={`/doctor/patients/${p.id}`}
              className="flex items-center justify-between bg-white rounded-xl border p-4 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {p.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{p.email}</p>
                  <p className="text-xs text-gray-400">ID: {p.id.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-blue-600">{p.count} randevu</p>
                <p className="text-xs text-gray-400">Son: {p.lastDate}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
