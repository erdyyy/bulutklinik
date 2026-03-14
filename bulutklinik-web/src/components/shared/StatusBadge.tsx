const colors: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-800',
  Pending:   'bg-yellow-100 text-yellow-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-blue-100 text-blue-800',
  NoShow:    'bg-gray-100 text-gray-800',
  Draft:     'bg-gray-100 text-gray-600',
  Issued:    'bg-blue-100 text-blue-700',
  Paid:      'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
