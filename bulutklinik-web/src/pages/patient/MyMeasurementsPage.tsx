import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { medicalApi } from '../../services/medicalApi';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const measurementLabels: Record<string, string> = {
  Weight: 'Kilo', Height: 'Boy', BloodPressure: 'Tansiyon',
  Temperature: 'Ateş', HeartRate: 'Nabız', SpO2: 'SpO2',
};

export function MyMeasurementsPage() {
  const userId = useAuthStore(s => s.userId)!;
  const [type, setType] = useState<string>('');

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['measurements', userId, type],
    queryFn: () => medicalApi.getMeasurements(userId, type || undefined),
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Ölçümlerim</h1>
      <div className="mb-4">
        <select
          value={type} onChange={e => setType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tümü</option>
          {Object.entries(measurementLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {measurements.length === 0 && <p className="text-gray-500">Ölçüm bulunamadı.</p>}
      <div className="space-y-2">
        {measurements.map((m: any) => (
          <div key={m.id} className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center">
            <div>
              <span className="font-medium text-sm">{measurementLabels[m.type] ?? m.type}</span>
              <span className="ml-3 text-blue-700 font-bold">{m.value} {m.unit}</span>
            </div>
            <span className="text-xs text-gray-400">{dayjs(m.measuredAt).format('DD.MM.YYYY HH:mm')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
