const colors: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700',
  Pending:   'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-red-100 text-red-700',
  Completed: 'bg-blue-100 text-blue-700',
}

const labels: Record<string, string> = {
  Confirmed: 'Onaylandı',
  Pending:   'Bekliyor',
  Cancelled: 'İptal',
  Completed: 'Tamamlandı',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}
