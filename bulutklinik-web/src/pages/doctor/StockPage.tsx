import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi } from '../../services/stockApi'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import { Plus, ArrowLeft, Package, AlertTriangle, CheckCircle2 } from 'lucide-react'

type StockView = 'list' | 'create'

interface StockStatus {
  label: string
  cls: string
  dotCls: string
}

function getStockStatus(item: any): StockStatus {
  if (item.currentQuantity === 0)
    return { label: 'Tükenmiş', cls: 'text-red-700 bg-red-50 border-red-200', dotCls: 'bg-red-500' }
  if (item.currentQuantity <= item.minimumQuantity)
    return { label: 'Kritik', cls: 'text-orange-700 bg-orange-50 border-orange-200', dotCls: 'bg-orange-400' }
  return { label: 'Normal', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotCls: 'bg-emerald-500' }
}

export default function StockPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<StockView>('list')
  const [search, setSearch] = useState('')
  const [movementId, setMovementId] = useState<string | null>(null)
  const [movementForm, setMovementForm] = useState({ type: 'In', quantity: '', notes: '' })
  const [createForm, setCreateForm] = useState({
    name: '', unit: '', currentQuantity: '', minimumQuantity: '', unitCost: '', category: '',
  })

  useEffect(() => { document.title = 'Stok Yönetimi – Medica.AI' }, [])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: stockApi.getAll,
    staleTime: 2 * 60 * 1000,
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

  const criticalItems = (items as any[]).filter(
    i => i.currentQuantity === 0 || i.currentQuantity <= i.minimumQuantity
  )

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  // ─── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === 'create') {
    const backBtn = (
      <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Geri
      </button>
    )
    return (
      <DoctorLayout title="Yeni Stok Kalemi" action={backBtn}>
        <div className="max-w-xl">
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
            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4"
          >
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">Ürün Adı *</label>
              <input type="text" value={createForm.name} placeholder="ör. Eldiven (M)"
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Birim *</label>
                <input type="text" value={createForm.unit} placeholder="Adet, Kutu, ml..."
                  onChange={e => setCreateForm(f => ({ ...f, unit: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Kategori</label>
                <input type="text" value={createForm.category}
                  onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Mevcut Miktar</label>
                <input type="number" min={0} value={createForm.currentQuantity}
                  onChange={e => setCreateForm(f => ({ ...f, currentQuantity: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Min. Miktar (kritik eşik)</label>
                <input type="number" min={0} value={createForm.minimumQuantity}
                  onChange={e => setCreateForm(f => ({ ...f, minimumQuantity: e.target.value }))}
                  className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1.5">Birim Maliyet (₺)</label>
                <input type="number" min={0} step="0.01" value={createForm.unitCost}
                  onChange={e => setCreateForm(f => ({ ...f, unitCost: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={createMutation.isPending}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                <CheckCircle2 size={14} />
                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setView('list')} className="px-4 py-2 text-sm text-gray-500">
                İptal
              </button>
            </div>
          </form>
        </div>
      </DoctorLayout>
    )
  }

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  const createBtn = (
    <button
      onClick={() => setView('create')}
      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
    >
      <Plus size={14} /> Ürün Ekle
    </button>
  )

  return (
    <DoctorLayout title="Stok Yönetimi" action={createBtn}>
      <div className="max-w-4xl space-y-5">

        {/* Critical alert */}
        {!isLoading && criticalItems.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-700">
              {criticalItems.length} ürün kritik seviyede veya tükenmiş durumda!
            </p>
          </div>
        )}

        {/* Search */}
        <input
          type="search"
          placeholder="Ürün ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} max-w-xs`}
        />

        {isLoading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Package size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="font-semibold text-gray-500">Stok kaydı bulunamadı</p>
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map((item: any) => {
            const status = getStockStatus(item)
            const isMoving = movementId === item.id
            const pct = item.minimumQuantity > 0
              ? Math.min(100, Math.round((item.currentQuantity / (item.minimumQuantity * 3)) * 100))
              : 100

            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.currentQuantity === 0 ? 'bg-red-50' :
                      item.currentQuantity <= item.minimumQuantity ? 'bg-orange-50' : 'bg-teal-50'
                    }`}>
                      <Package size={18} className={
                        item.currentQuantity === 0 ? 'text-red-500' :
                        item.currentQuantity <= item.minimumQuantity ? 'text-orange-500' : 'text-teal-600'
                      } />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${status.cls}`}>
                          {status.label}
                        </span>
                        {item.category && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm">
                          <span className="font-bold text-gray-800">{item.currentQuantity}</span>
                          <span className="text-gray-400 text-xs"> / {item.minimumQuantity} min · {item.unit}</span>
                        </span>
                        {item.unitCost > 0 && (
                          <span className="text-xs text-gray-400">₺{item.unitCost?.toFixed(2)}/birim</span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden w-32">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.currentQuantity === 0 ? 'bg-red-400' :
                            item.currentQuantity <= item.minimumQuantity ? 'bg-orange-400' : 'bg-teal-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMovementId(isMoving ? null : item.id)
                      setMovementForm({ type: 'In', quantity: '', notes: '' })
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                      isMoving
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                    }`}
                  >
                    {isMoving ? 'İptal' : 'Hareket Ekle'}
                  </button>
                </div>

                {/* Movement form */}
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
                    className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hareket Tipi</label>
                      <select value={movementForm.type}
                        onChange={e => setMovementForm(f => ({ ...f, type: e.target.value }))}
                        className={inputCls}>
                        <option value="In">Giriş (+)</option>
                        <option value="Out">Çıkış (-)</option>
                        <option value="Adjustment">Düzeltme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Miktar</label>
                      <input type="number" min={1} value={movementForm.quantity}
                        onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
                        placeholder="Adet" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Not</label>
                      <input type="text" value={movementForm.notes}
                        onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Açıklama" className={inputCls} />
                    </div>
                    <div className="col-span-3">
                      <button type="submit" disabled={movementMutation.isPending}
                        className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                        <CheckCircle2 size={14} />
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
    </DoctorLayout>
  )
}
