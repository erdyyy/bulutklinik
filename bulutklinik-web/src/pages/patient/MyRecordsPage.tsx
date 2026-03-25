import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { medicalApi } from '../../services/medicalApi'
import PatientLayout from '../../components/patient/PatientLayout'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

export default function MyRecordsPage() {
  const { userId } = useAuthStore()

  useEffect(() => { document.title = 'Muayene Geçmişi – BulutKlinik' }, [])

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['my-records', userId],
    queryFn: () => medicalApi.getRecords(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <PatientLayout title="Muayene Geçmişi">
      <div className="max-w-2xl space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-24 mb-4" />
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && records.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-4">🩺</div>
            <p className="font-semibold text-gray-700">Henüz muayene kaydınız bulunmuyor</p>
            <p className="text-sm text-gray-400 mt-1">Doktora muayene olduğunuzda kayıtlarınız burada görünecek.</p>
          </div>
        )}

        {(records as any[]).map((r: any) => (
          <article key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-gray-900">{r.doctorName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{dayjs(r.createdAt).format('DD MMMM YYYY')}</p>
              </div>
              {r.icdCode && (
                <span className="bg-blue-100 text-blue-700 text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                  {r.icdCode}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm border-t border-gray-50 pt-3">
              {r.chiefComplaint && (
                <div className="flex gap-2">
                  <span className="text-gray-400 font-medium w-20 flex-shrink-0">Şikayet</span>
                  <span className="text-gray-700">{r.chiefComplaint}</span>
                </div>
              )}
              {r.findings && (
                <div className="flex gap-2">
                  <span className="text-gray-400 font-medium w-20 flex-shrink-0">Bulgular</span>
                  <span className="text-gray-700">{r.findings}</span>
                </div>
              )}
              {r.diagnosis && (
                <div className="flex gap-2">
                  <span className="text-gray-400 font-medium w-20 flex-shrink-0">Tanı</span>
                  <span className="text-gray-900 font-semibold">{r.diagnosis}</span>
                </div>
              )}
              {r.treatmentPlan && (
                <div className="flex gap-2">
                  <span className="text-gray-400 font-medium w-20 flex-shrink-0">Tedavi</span>
                  <span className="text-gray-700">{r.treatmentPlan}</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </PatientLayout>
  )
}
