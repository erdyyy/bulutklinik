import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '../../services/invoiceApi';
import { StatusBadge } from '../../components/shared/StatusBadge';
import dayjs from 'dayjs';

export function InvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices(),
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Faturalar</h1>
      {invoices.length === 0 && <p className="text-gray-500">Fatura bulunamadı.</p>}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Hasta</th>
              <th className="px-4 py-3 text-left">Tutar</th>
              <th className="px-4 py-3 text-left">Durum</th>
              <th className="px-4 py-3 text-left">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{inv.patientEmail}</td>
                <td className="px-4 py-3 font-semibold">₺{inv.totalAmount?.toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-3 text-gray-400">{dayjs(inv.createdAt).format('DD.MM.YYYY')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
