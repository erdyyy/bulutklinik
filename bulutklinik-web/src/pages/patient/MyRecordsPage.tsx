import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { medicalApi } from '../../services/medicalApi'
import Navbar from '../../components/shared/Navbar'
import dayjs from 'dayjs'

export default function MyRecordsPage() {
  const { userId } = useAuthStore()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['my-records', userId],
    queryFn: () => medicalApi.getRecords(userId!),
    enabled: !!userId,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Muayene Geçmişim</h1>

        {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
        {!isLoading && records.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            Henüz muayene kaydınız bulunmuyor.
          </div>
        )}

        <div className="space-y-4">
          {records.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{r.doctorName}</p>
                  <p className="text-sm text-gray-500">{dayjs(r.createdAt).format('DD MMM YYYY')}</p>
                </div>
                {r.icdCode && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-1 rounded">
                    {r.icdCode}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div><span className="font-medium text-gray-600">Şikayet:</span> <span className="text-gray-800">{r.chiefComplaint}</span></div>
                {r.findings && <div><span className="font-medium text-gray-600">Bulgular:</span> <span className="text-gray-800">{r.findings}</span></div>}
                {r.diagnosis && <div><span className="font-medium text-gray-600">Tanı:</span> <span className="text-gray-800 font-semibold">{r.diagnosis}</span></div>}
                {r.treatmentPlan && <div><span className="font-medium text-gray-600">Tedavi:</span> <span className="text-gray-800">{r.treatmentPlan}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
