import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi } from '../../services/stockApi'
import Navbar from '../../components/shared/Navbar'

type StockView = 'list' | 'create'

export default function StockPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<StockView>('list')
  const [search, setSearch] = useState('')
  const [movementId, setMovementId] = useState<string | null>(null)
  const [movementForm, setMovementForm] = useState({ type: 'In', quantity: '', notes: '' })
  const [createForm, setCreateForm] = useState({
    name: '', unit: '', currentQuantity: '', minimumQuantity: '', unitCost: '', category: '',
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: stockApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => stockApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setView('list')
      setCreateForm({ name: '', unit: '', currentQuantity: '', minimumQuantity: '', unitCost: '', category: '' })
    },
  })

  const movementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => stockApi.addMovement(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setMovementId(null)
      setMovementForm({ type: 'In', quantity: '', notes: '' })
    },
  })

  const filtered = (items as any[]).filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase())
  )

  const getStockStatus = (item: any) => {
    if (item.currentQuantity === 0) return { label: 'Tükenmiş', cls: 'bg-red-100 text-red-700' }
    if (item.currentQuantity <= item.minimumQuantity) return { label: 'Kritik', cls: 'bg-orange-100 text-orange-700' }
    return { label: 'Normal', cls: 'bg-green-100 text-green-700' }
  }

  // ─── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
            <h1 className="text-2xl font-bold text-gray-800">Yeni Stok Kalemi</h1>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!createForm.name || !createForm.unit) return
              createMutation.mutate({
                name: createForm.name,
                unit: createForm.unit,
                currentQuantity: parseInt(createForm.currentQuantity) || 0,
                minimumQuantity: parseInt(createForm.minimumQuantity) || 0,
                unitCost: parseFloat(createForm.unitCost) || 0,
                category: createForm.category,
              })
            }}
            className="bg-white rounded-xl border p-6 shadow-sm space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Ürün Adı *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="ör. Eldiven (M)"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Birim *</label>
                <input
                  type="text"
                  value={createForm.unit}
                  onChange={e => setCreateForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Adet, Kutu, ml..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Kategori</label>
                <input
                  type="text"
                  value={createForm.category}
                  onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mevcut Miktar</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.currentQuantity}
                  onChange={e => setCreateForm(f => ({ ...f, currentQuantity: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Min. Miktar</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.minimumQuantity}
                  onChange={e => setCreateForm(f => ({ ...f, minimumQuantity: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Birim Maliyet (₺)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={createForm.unitCost}
                  onChange={e => setCreateForm(f => ({ ...f, unitCost: e.target.value }))}
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
                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
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

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Stok Yönetimi</h1>
          <button
            onClick={() => setView('create')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Ürün Ekle
          </button>
        </div>

        <div className="mb-5">
          <input
            type="text"
            placeholder="Ürün ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Stok kaydı bulunamadı.</div>
        )}

        <div className="space-y-3">
          {filtered.map((item: any) => {
            const status = getStockStatus(item)
            const isMoving = movementId === item.id
            return (
              <div key={item.id} className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                      {item.category && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.category}</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500">
                      <span>
                        <span className="font-bold text-gray-800 text-base">{item.currentQuantity}</span> {item.unit}
                      </span>
                      <span>Min: {item.minimumQuantity} {item.unit}</span>
                      {item.unitCost > 0 && <span>₺{item.unitCost?.toFixed(2)}/birim</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setMovementId(isMoving ? null : item.id); setMovementForm({ type: 'In', quantity: '', notes: '' }) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isMoving
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {isMoving ? 'İptal' : 'Hareket Ekle'}
                  </button>
                </div>

                {/* Hareket formu */}
                {isMoving && (
                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      if (!movementForm.quantity) return
                      movementMutation.mutate({
                        id: item.id,
                        data: {
                          type: movementForm.type,
                          quantity: parseInt(movementForm.quantity),
                          notes: movementForm.notes,
                        },
                      })
                    }}
                    className="mt-4 pt-4 border-t grid grid-cols-3 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hareket Tipi</label>
                      <select
                        value={movementForm.type}
                        onChange={e => setMovementForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="In">Giriş (+)</option>
                        <option value="Out">Çıkış (-)</option>
                        <option value="Adjustment">Düzeltme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Miktar</label>
                      <input
                        type="number"
                        min={1}
                        value={movementForm.quantity}
                        onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Adet"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Not</label>
                      <input
                        type="text"
                        value={movementForm.notes}
                        onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Açıklama"
                      />
                    </div>
                    <div className="col-span-3">
                      <button
                        type="submit"
                        disabled={movementMutation.isPending}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                      >
                        {movementMutation.isPending ? 'Kaydediliyor...' : 'Hareketi Kaydet'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
