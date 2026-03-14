import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

export function PatientListPage() {
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get('/api/users?role=Patient').then(r => r.data).catch(() => []),
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Hasta Listesi</h1>
      {patients.length === 0 && <p className="text-gray-500">Kayıtlı hasta bulunamadı.</p>}
      <div className="space-y-2">
        {patients.map((p: any) => (
          <Link
            key={p.id}
            to={`/doctor/patients/${p.id}`}
            className="block bg-white rounded-lg shadow px-4 py-3 hover:bg-blue-50 transition"
          >
            <p className="font-medium">{p.email}</p>
            <p className="text-xs text-gray-400">{p.phoneNumber}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
