import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceApi } from '../../services/invoiceApi'
import Navbar from '../../components/shared/Navbar'
import dayjs from 'dayjs'

const STATUS_LABELS: Record<string, string> = {
  Draft: 'Taslak', Issued: 'Kesildi', Paid: 'Ödendi', Cancelled: 'İptal',
}
const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Issued: 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
}

type InvoiceView = 'list' | 'create' | 'detail'

export default function InvoicesPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<InvoiceView>('list')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [patientIdFilter, setPatientIdFilter] = useState('')
  const [createForm, setCreateForm] = useState({
    patientId: '', appointmentId: '', discountAmount: '0', notes: '',
    items: [{ serviceId: '', quantity: 1 }],
  })
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Cash', note: '' })
  const [showPayment, setShowPayment] = useState(false)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', patientIdFilter],
    queryFn: () => invoiceApi.getInvoices(patientIdFilter || undefined),
  })

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: invoiceApi.getServices,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => invoiceApi.createInvoice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setView('list')
      setCreateForm({ patientId: '', appointmentId: '', discountAmount: '0', notes: '', items: [{ serviceId: '', quantity: 1 }] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      invoiceApi.updateStatus(id, status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setSelectedInvoice(updated)
    },
  })

  const paymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      invoiceApi.addPayment(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setSelectedInvoice(updated)
      setShowPayment(false)
      setPaymentForm({ amount: '', method: 'Cash', note: '' })
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = createForm.items.filter(i => i.serviceId)
    if (!createForm.patientId || validItems.length === 0) return
    createMutation.mutate({
      patientId: createForm.patientId,
      appointmentId: createForm.appointmentId || null,
      discountAmount: parseFloat(createForm.discountAmount) || 0,
      notes: createForm.notes,
      items: validItems.map(i => ({ serviceId: i.serviceId, quantity: i.quantity })),
    })
  }

  const addItem = () =>
    setCreateForm(f => ({ ...f, items: [...f.items, { serviceId: '', quantity: 1 }] }))

  const removeItem = (idx: number) =>
    setCreateForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Faturalar</h1>
            <button
              onClick={() => setView('create')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Fatura Oluştur
            </button>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Hasta ID ile filtrele..."
              value={patientIdFilter}
              onChange={e => setPatientIdFilter(e.target.value)}
              className="border rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
          {!isLoading && invoices.length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Fatura bulunamadı.</div>
          )}

          <div className="space-y-3">
            {(invoices as any[]).map(inv => (
              <div
                key={inv.id}
                onClick={() => { setSelectedInvoice(inv); setView('detail') }}
                className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div>
                  <p className="font-mono text-xs text-gray-400">{inv.invoiceNumber}</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    Hasta: <span className="font-mono text-xs">{inv.patientId?.slice(0, 8)}...</span>
                  </p>
                  <p className="text-xs text-gray-400">{dayjs(inv.createdAt).format('DD MMM YYYY')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">₺{inv.totalAmount?.toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
            <h1 className="text-2xl font-bold text-gray-800">Yeni Fatura</h1>
          </div>

          <form onSubmit={handleCreateSubmit} className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Hasta ID *</label>
                <input
                  type="text"
                  value={createForm.patientId}
                  onChange={e => setCreateForm(f => ({ ...f, patientId: e.target.value }))}
                  placeholder="UUID"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Randevu ID (opsiyonel)</label>
                <input
                  type="text"
                  value={createForm.appointmentId}
                  onChange={e => setCreateForm(f => ({ ...f, appointmentId: e.target.value }))}
                  placeholder="UUID"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">Hizmetler *</label>
              {createForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={item.serviceId}
                    onChange={e => {
                      const items = [...createForm.items]
                      items[idx] = { ...items[idx], serviceId: e.target.value }
                      setCreateForm(f => ({ ...f, items }))
                    }}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Hizmet seç</option>
                    {(services as any[]).map(s => (
                      <option key={s.id} value={s.id}>{s.name} — ₺{s.price}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => {
                      const items = [...createForm.items]
                      items[idx] = { ...items[idx], quantity: parseInt(e.target.value) }
                      setCreateForm(f => ({ ...f, items }))
                    }}
                    className="w-16 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {createForm.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} className="text-blue-600 text-sm hover:underline mt-1">
                + Hizmet Ekle
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">İndirim (₺)</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.discountAmount}
                  onChange={e => setCreateForm(f => ({ ...f, discountAmount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Not</label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Oluşturuluyor...' : 'Fatura Oluştur'}
              </button>
              <button type="button" onClick={() => setView('list')} className="px-4 py-2 text-sm text-gray-500">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── DETAIL VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-800">Fatura Detayı</h1>
        </div>

        {selectedInvoice && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="font-mono font-bold text-gray-800">{selectedInvoice.invoiceNumber}</p>
                <p className="text-xs text-gray-400 mt-1">{dayjs(selectedInvoice.createdAt).format('DD MMM YYYY')}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selectedInvoice.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[selectedInvoice.status] ?? selectedInvoice.status}
              </span>
            </div>

            {/* Hizmet kalemleri */}
            <div className="border rounded-lg overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Hizmet</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Adet</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Birim</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items ?? []).map((item: any) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">{item.serviceName}</td>
                      <td className="text-right px-4 py-2">{item.quantity}</td>
                      <td className="text-right px-4 py-2">₺{item.unitPrice?.toFixed(2)}</td>
                      <td className="text-right px-4 py-2 font-medium">₺{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-right text-sm space-y-1 mb-5">
              <p className="text-gray-500">Ara Toplam: ₺{selectedInvoice.subTotal?.toFixed(2)}</p>
              {selectedInvoice.discountAmount > 0 && (
                <p className="text-red-500">İndirim: -₺{selectedInvoice.discountAmount?.toFixed(2)}</p>
              )}
              <p className="text-lg font-bold text-gray-800">Toplam: ₺{selectedInvoice.totalAmount?.toFixed(2)}</p>
            </div>

            {/* Ödeme geçmişi */}
            {(selectedInvoice.payments ?? []).length > 0 && (
              <div className="mb-5">
                <h3 className="font-medium text-gray-700 mb-2 text-sm">Ödemeler</h3>
                {selectedInvoice.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span className="text-gray-600">{p.method} — {dayjs(p.paidAt).format('DD MMM YYYY')}</span>
                    <span className="font-medium text-green-700">₺{p.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Aksiyon butonları */}
            <div className="flex gap-2 flex-wrap">
              {selectedInvoice.status === 'Draft' && (
                <button
                  onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'Issued' })}
                  disabled={statusMutation.isPending}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-60"
                >
                  Faturayı Kes
                </button>
              )}
              {selectedInvoice.status === 'Issued' && (
                <>
                  <button
                    onClick={() => setShowPayment(v => !v)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Ödeme Al
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'Cancelled' })}
                    disabled={statusMutation.isPending}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-60"
                  >
                    İptal Et
                  </button>
                </>
              )}
            </div>

            {/* Ödeme formu */}
            {showPayment && (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  paymentMutation.mutate({
                    id: selectedInvoice.id,
                    data: { amount: parseFloat(paymentForm.amount), method: paymentForm.method, note: paymentForm.note },
                  })
                }}
                className="mt-4 bg-green-50 rounded-xl p-4 border border-green-200"
              >
                <h3 className="font-medium text-green-800 mb-3 text-sm">Ödeme Bilgisi</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tutar (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Yöntem</label>
                    <select
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="Cash">Nakit</option>
                      <option value="CreditCard">Kredi Kartı</option>
                      <option value="BankTransfer">Havale</option>
                      <option value="Insurance">Sigorta</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">Not</label>
                  <input
                    type="text"
                    value={paymentForm.note}
                    onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={paymentMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                  >
                    {paymentMutation.isPending ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                  </button>
                  <button type="button" onClick={() => setShowPayment(false)} className="text-sm text-gray-500 px-3">
                    İptal
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
