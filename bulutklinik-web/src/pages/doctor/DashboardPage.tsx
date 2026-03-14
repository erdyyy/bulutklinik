import { useQuery } from '@tanstack/react-query';
import { stockApi } from '../../services/stockApi';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: stockApi.getDashboard,
  });

  const kpis = [
    { label: 'Bugünkü Randevular', value: data?.todayAppointments ?? '-', color: 'bg-blue-500' },
    { label: 'Aylık Gelir (₺)', value: data?.monthlyRevenue?.toFixed(2) ?? '-', color: 'bg-green-500' },
    { label: 'Toplam Hasta', value: data?.totalPatients ?? '-', color: 'bg-purple-500' },
    { label: 'Bekleyen Fatura', value: data?.pendingInvoices ?? '-', color: 'bg-orange-500' },
  ];

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`${k.color} text-white rounded-xl p-5 shadow`}>
            <p className="text-sm opacity-80">{k.label}</p>
            <p className="text-3xl font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
