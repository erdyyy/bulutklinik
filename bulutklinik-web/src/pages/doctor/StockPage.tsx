import { useQuery } from '@tanstack/react-query';
import { stockApi } from '../../services/stockApi';

export function StockPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: stockApi.getStock,
  });

  if (isLoading) return <p className="p-6 text-gray-500">Yükleniyor...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Stok Yönetimi</h1>
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Ürün</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Miktar</th>
              <th className="px-4 py-3 text-right">Min. Miktar</th>
              <th className="px-4 py-3 text-left">Durum</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">{item.category ?? '-'}</td>
                <td className="px-4 py-3 text-right">{item.currentQuantity} {item.unit}</td>
                <td className="px-4 py-3 text-right text-gray-400">{item.minimumQuantity}</td>
                <td className="px-4 py-3">
                  {item.isLow
                    ? <span className="text-red-600 text-xs font-semibold">DÜŞÜK STOK</span>
                    : <span className="text-green-600 text-xs">Normal</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
