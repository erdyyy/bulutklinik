import { useQuery } from '@tanstack/react-query';
import { medicalApi } from '../../services/medicalApi';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

export function MyRecordsPage() {
  const userId = useAuthStore(s => s.userId)!;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['medical-records', userId],
    queryFn: () => medicalApi.getMedicalRecords(userId),
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Muayene Geçmişim</h1>
      {records.length === 0 && <p className="text-gray-500">Kayıt bulunamadı.</p>}
      <div className="space-y-3">
        {records.map((r: any) => (
          <div key={r.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold">Dr. {r.doctorName}</span>
              <span className="text-xs text-gray-400">{dayjs(r.createdAt).format('DD.MM.YYYY')}</span>
            </div>
            <p className="text-sm"><strong>Şikayet:</strong> {r.chiefComplaint}</p>
            {r.diagnosis && <p className="text-sm"><strong>Tanı:</strong> {r.diagnosis}</p>}
            {r.treatmentPlan && <p className="text-sm"><strong>Tedavi:</strong> {r.treatmentPlan}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
