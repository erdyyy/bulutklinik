import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { invoiceApi } from '../../services/invoiceApi'
import { packageApi } from '../../services/packageApi'
import { useAuthStore } from '../../store/authStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import { Plus, ArrowLeft, CheckCircle2, Receipt, Package, ChevronDown, ChevronUp, X, Printer } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

// ─── Invoice status config ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  Draft:     { label: 'Taslak', cls: 'text-gray-600 bg-gray-100 border-gray-200',         dot: 'bg-gray-400' },
  Issued:    { label: 'Kesildi', cls: 'text-amber-700 bg-amber-50 border-amber-200',      dot: 'bg-amber-400' },
  Paid:      { label: 'Ödendi', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  Cancelled: { label: 'İptal', cls: 'text-red-600 bg-red-50 border-red-200',              dot: 'bg-red-400' },
}

type PkgFilter = 'all' | 'active' | 'completed' | 'expired'

function pkgStatus(pkg: any): 'active' | 'completed' | 'expired' {
  if (pkg.completedSessions >= pkg.totalSessions) return 'completed'
  if (dayjs(pkg.expiresAt).isBefore(dayjs(), 'day')) return 'expired'
  return 'active'
}

type InvoiceView = 'list' | 'create' | 'detail' | 'packages'

export default function InvoicesPage() {
  const qc = useQueryClient()
  const { userId } = useAuthStore()
  const location = useLocation()
  const aiState = location.state as { fromAI?: boolean; patientId?: string; planNote?: string } | null

  const [view, setView] = useState<InvoiceView>(aiState?.fromAI ? 'create' : 'list')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [patientIdFilter, setPatientIdFilter] = useState('')
  const [createForm, setCreateForm] = useState({
    patientId:      aiState?.patientId ?? '',
    appointmentId:  '',
    discountAmount: '0',
    notes:          aiState?.planNote ?? '',
    items: [{ serviceId: '', quantity: 1 }],
  })
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Cash', note: '' })
  const [showPayment, setShowPayment] = useState(false)

  // Packages state
  const [pkgFilter, setPkgFilter]       = useState<PkgFilter>('all')
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set())
  const [showPkgModal, setShowPkgModal] = useState(false)
  const [pkgForm, setPkgForm]           = useState({
    patientId: '', packageName: '', serviceName: '',
    totalSessions: 5, pricePerPackage: '', isPaid: false,
    expiresAt: dayjs().add(6, 'month').format('YYYY-MM-DD'), notes: '',
  })

  useEffect(() => { document.title = 'Faturalar – BulutKlinik' }, [])

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', patientIdFilter],
    queryFn: () => invoiceApi.getInvoices(patientIdFilter || undefined),
    staleTime: 2 * 60 * 1000,
  })

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: invoiceApi.getServices,
    staleTime: 10 * 60 * 1000,
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

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  // Summary counts
  const summary = {
    total: (invoices as any[]).length,
    paid: (invoices as any[]).filter((i: any) => i.status === 'Paid').length,
    issued: (invoices as any[]).filter((i: any) => i.status === 'Issued').length,
  }

  // ─── Package API queries & mutations ────────────────────────────────────────
  const { data: packagesData = [], isLoading: loadingPkgs } = useQuery({
    queryKey: ['packages', userId],
    queryFn: () => packageApi.getByDoctor(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
  const packages = packagesData as any[]

  const createPkgMutation = useMutation({
    mutationFn: (data: object) => packageApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages', userId] })
      setShowPkgModal(false)
      setPkgForm({ patientId: '', packageName: '', serviceName: '', totalSessions: 5, pricePerPackage: '', isPaid: false, expiresAt: dayjs().add(6, 'month').format('YYYY-MM-DD'), notes: '' })
    },
  })

  const sessionMutation = useMutation({
    mutationFn: (pkgId: string) => packageApi.completeSession(pkgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages', userId] }),
  })

  const savePkg = () => {
    if (!pkgForm.patientId || !pkgForm.packageName || !pkgForm.pricePerPackage) return
    createPkgMutation.mutate({
      doctorId:       userId,
      patientId:      pkgForm.patientId,
      packageName:    pkgForm.packageName,
      serviceName:    pkgForm.serviceName,
      totalSessions:  pkgForm.totalSessions,
      pricePerPackage: parseFloat(pkgForm.pricePerPackage) || 0,
      isPaid:         pkgForm.isPaid,
      notes:          pkgForm.notes || null,
      expiresAt:      pkgForm.expiresAt,
    })
  }

  const markSession = (pkgId: string) => sessionMutation.mutate(pkgId)

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    const createBtn = (
      <button
        onClick={() => setView('create')}
        className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
      >
        <Plus size={14} /> Fatura Oluştur
      </button>
    )
    return (
      <DoctorLayout title="Faturalar" action={createBtn}>
        <div className="max-w-4xl space-y-5">

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
            {[
              { key: 'list' as InvoiceView,     label: 'Fatura Listesi', Icon: Receipt },
              { key: 'packages' as InvoiceView, label: 'Paketler',       Icon: Package },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  view === key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Summary stats */}
          {!isLoading && (invoices as any[]).length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Toplam', value: summary.total, cls: 'text-gray-800', bg: 'bg-gray-50 text-gray-500' },
                { label: 'Bekleyen', value: summary.issued, cls: 'text-amber-700', bg: 'bg-amber-50 text-amber-500' },
                { label: 'Ödenen', value: summary.paid, cls: 'text-emerald-700', bg: 'bg-emerald-50 text-emerald-500' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 border border-gray-100 bg-white flex items-center gap-3`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                    <Receipt size={16} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter */}
          <input
            type="text"
            placeholder="Hasta ID ile filtrele..."
            value={patientIdFilter}
            onChange={e => setPatientIdFilter(e.target.value)}
            className={`${inputCls} max-w-xs`}
          />

          {isLoading && (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
            </div>
          )}
          {!isLoading && (invoices as any[]).length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Receipt size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="font-semibold text-gray-500">Fatura bulunamadı</p>
            </div>
          )}

          <div className="space-y-2.5">
            {(invoices as any[]).map(inv => {
              const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.Draft
              return (
                <div
                  key={inv.id}
                  onClick={() => { setSelectedInvoice(inv); setView('detail') }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between cursor-pointer hover:border-teal-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${cfg.dot}`} />
                    <div>
                      <p className="font-mono text-xs text-gray-400">{inv.invoiceNumber}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">
                        {inv.patientId?.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-400">{dayjs(inv.createdAt).format('DD MMM YYYY')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800 text-base">₺{inv.totalAmount?.toFixed(2)}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DoctorLayout>
    )
  }

  // ─── PACKAGES VIEW ──────────────────────────────────────────────────────────
  if (view === 'packages') {
    const thisMonthStart = dayjs().startOf('month').toISOString()

    const activeCount   = packages.filter((p: any) => pkgStatus(p) === 'active').length
    const soldThisMonth = packages.filter((p: any) => new Date(p.soldAt) >= new Date(thisMonthStart)).length
    const expiredCount  = packages.filter((p: any) => pkgStatus(p) === 'expired').length

    const filtered = pkgFilter === 'all' ? packages : packages.filter((p: any) => pkgStatus(p) === pkgFilter)

    const inputCls2 = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

    return (
      <DoctorLayout title="Paket / Seans Takibi" action={
        <button onClick={() => setShowPkgModal(true)}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors">
          <Plus size={14} /> Yeni Paket Sat
        </button>
      }>
        <div className="max-w-4xl space-y-5">

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
            {[
              { key: 'list' as InvoiceView,     label: 'Fatura Listesi', Icon: Receipt },
              { key: 'packages' as InvoiceView, label: 'Paketler',       Icon: Package },
            ].map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  view === key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Stat kartları */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Aktif Paketler',   value: activeCount,   cls: 'text-teal-600',   bg: 'bg-teal-50' },
              { label: 'Bu Ay Satılan',    value: soldThisMonth, cls: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Süresi Dolan',     value: expiredCount,  cls: 'text-red-600',    bg: 'bg-red-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 border border-gray-100 bg-white flex items-center gap-3`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <Package size={16} className={s.cls} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filtre */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all' as PkgFilter,       label: 'Tümü' },
              { key: 'active' as PkgFilter,    label: 'Aktif' },
              { key: 'completed' as PkgFilter, label: 'Tamamlanan' },
              { key: 'expired' as PkgFilter,   label: 'Süresi Dolmuş' },
            ].map(f => (
              <button key={f.key} onClick={() => setPkgFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  pkgFilter === f.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Boş durum */}
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Package size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-600 font-semibold mb-1">Paket bulunamadı</p>
              <p className="text-gray-400 text-sm mb-4">Henüz bu kategoride paket kaydı yok.</p>
              <button onClick={() => setShowPkgModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700">
                Yeni Paket Sat
              </button>
            </div>
          )}

          {loadingPkgs && (
            <div className="space-y-2.5">
              {[1,2].map(i => <div key={i} className="h-24 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
            </div>
          )}

          {/* Paket kartları */}
          <div className="space-y-3">
            {filtered.map((pkg: any) => {
              const st = pkgStatus(pkg)
              const pct = Math.round((pkg.completedSessions / pkg.totalSessions) * 100)
              const isExpanded = expandedPkgs.has(pkg.id)
              const isExpired = st === 'expired'

              return (
                <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-gray-800">{pkg.patientName || pkg.patientId?.slice(0,8)}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            st === 'active'    ? 'text-teal-600 bg-teal-50 border-teal-200' :
                            st === 'completed' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                            'text-red-600 bg-red-50 border-red-200'
                          }`}>
                            {st === 'active' ? 'Aktif' : st === 'completed' ? 'Tamamlandı' : 'Süresi Doldu'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            pkg.paid ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200'
                          }`}>
                            {pkg.paid ? 'Ödendi' : 'Bekliyor'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{pkg.packageName}</p>
                        {pkg.serviceName && <p className="text-xs text-gray-400">{pkg.serviceName}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-teal-700">₺{pkg.pricePerPackage.toLocaleString('tr-TR')}</p>
                        <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          SKT: {dayjs(pkg.expiresAt).format('DD MMM YYYY')}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${pkg.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {pkg.isPaid ? 'Ödendi' : 'Ödeme Bekliyor'}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500">{pkg.completedSessions}/{pkg.totalSessions} seans tamamlandı</span>
                        <span className="text-xs font-semibold text-teal-600">{pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            st === 'completed' ? 'bg-blue-500' : st === 'expired' ? 'bg-red-400' : 'bg-teal-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 mt-3">
                      {st === 'active' && (
                        <button
                          onClick={() => markSession(pkg.id)}
                          disabled={sessionMutation.isPending}
                          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          <CheckCircle2 size={13} /> Seans İşaretle
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedPkgs(prev => {
                          const n = new Set(prev); n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id); return n
                        })}
                        className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-xs px-2 py-1.5 rounded-xl hover:bg-gray-50"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {isExpanded ? 'Daralt' : 'Seans Detayı'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded sessions */}
                  {isExpanded && (
                    <div className="border-t border-gray-50 bg-gray-50/50 p-4">
                      <div className="space-y-1.5">
                        {(pkg.sessions ?? []).map((s: any) => (
                          <div key={s.sessionNumber} className="flex items-center gap-3 text-sm">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              s.completedAt ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'
                            }`}>
                              <span className="text-[10px] font-bold">{s.sessionNumber}</span>
                            </div>
                            <span className="text-gray-600">Seans {s.sessionNumber}</span>
                            {s.completedAt ? (
                              <span className="text-xs text-teal-600 font-medium ml-auto">
                                {dayjs(s.completedAt).format('DD MMM YYYY HH:mm')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 ml-auto">Bekliyor</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {pkg.notes && (
                        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 italic">Not: {pkg.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Yeni Paket Sat Modal */}
        {showPkgModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPkgModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Yeni Tedavi Paketi Sat</h3>
                <button onClick={() => setShowPkgModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Hasta ID *</label>
                    <input type="text" value={pkgForm.patientId}
                      onChange={e => setPkgForm(f => ({ ...f, patientId: e.target.value }))}
                      placeholder="UUID" className={inputCls2} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Paket Adı *</label>
                    <input type="text" value={pkgForm.packageName}
                      onChange={e => setPkgForm(f => ({ ...f, packageName: e.target.value }))}
                      placeholder="ör. 10 Seans Lazer Epilasyon" className={inputCls2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Servis Adı</label>
                    <input type="text" value={pkgForm.serviceName}
                      onChange={e => setPkgForm(f => ({ ...f, serviceName: e.target.value }))}
                      placeholder="ör. Lazer Epilasyon" className={inputCls2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Toplam Seans Sayısı *</label>
                    <input type="number" min={1} max={100} value={pkgForm.totalSessions}
                      onChange={e => setPkgForm(f => ({ ...f, totalSessions: parseInt(e.target.value) || 1 }))}
                      className={inputCls2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Toplam Fiyat (₺) *</label>
                    <input type="number" min={0} step={0.01} value={pkgForm.pricePerPackage}
                      onChange={e => setPkgForm(f => ({ ...f, pricePerPackage: e.target.value }))}
                      placeholder="0.00" className={inputCls2} />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Son Kullanma Tarihi</label>
                    <input type="date" value={pkgForm.expiresAt}
                      onChange={e => setPkgForm(f => ({ ...f, expiresAt: e.target.value }))}
                      className={inputCls2} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Notlar</label>
                    <textarea rows={2} value={pkgForm.notes}
                      onChange={e => setPkgForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Varsa notlarınızı buraya yazın..." className={inputCls2 + ' resize-none'} />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={pkgForm.isPaid}
                        onChange={e => setPkgForm(f => ({ ...f, isPaid: e.target.checked }))}
                        className="w-4 h-4 accent-teal-600 rounded" />
                      <span className="text-sm text-gray-600 font-medium">Ödeme alındı</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 p-5 border-t border-gray-100">
                <button onClick={savePkg}
                  disabled={!pkgForm.patientId || !pkgForm.packageName || !pkgForm.pricePerPackage || createPkgMutation.isPending}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                  {createPkgMutation.isPending ? 'Kaydediliyor...' : 'Paketi Kaydet'}
                </button>
                <button onClick={() => setShowPkgModal(false)} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700">İptal</button>
              </div>
            </div>
          </div>
        )}
      </DoctorLayout>
    )
  }

  // ─── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === 'create') {
    const backBtn = (
      <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Geri
      </button>
    )
    return (
      <DoctorLayout title="Yeni Fatura" action={backBtn}>
        <div className="max-w-2xl">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Hasta ID *</label>
                <input type="text" value={createForm.patientId}
                  onChange={e => setCreateForm(f => ({ ...f, patientId: e.target.value }))}
                  placeholder="UUID" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Randevu ID (opsiyonel)</label>
                <input type="text" value={createForm.appointmentId}
                  onChange={e => setCreateForm(f => ({ ...f, appointmentId: e.target.value }))}
                  placeholder="UUID" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Hizmetler *</label>
              <div className="space-y-2">
                {createForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={item.serviceId}
                      onChange={e => {
                        const items = [...createForm.items]
                        items[idx] = { ...items[idx], serviceId: e.target.value }
                        setCreateForm(f => ({ ...f, items }))
                      }}
                      className={`flex-1 ${inputCls}`}
                    >
                      <option value="">Hizmet seç</option>
                      {(services as any[]).map(s => (
                        <option key={s.id} value={s.id}>{s.name} — ₺{s.price}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={1} value={item.quantity}
                      onChange={e => {
                        const items = [...createForm.items]
                        items[idx] = { ...items[idx], quantity: parseInt(e.target.value) }
                        setCreateForm(f => ({ ...f, items }))
                      }}
                      className="w-16 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    {createForm.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600 text-xl px-1">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-teal-600 text-sm hover:underline mt-2">
                <Plus size={13} /> Hizmet Ekle
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">İndirim (₺)</label>
                <input type="number" min={0} value={createForm.discountAmount}
                  onChange={e => setCreateForm(f => ({ ...f, discountAmount: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Not</label>
                <input type="text" value={createForm.notes}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={createMutation.isPending}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                <CheckCircle2 size={14} />
                {createMutation.isPending ? 'Oluşturuluyor...' : 'Fatura Oluştur'}
              </button>
              <button type="button" onClick={() => setView('list')} className="px-4 py-2 text-sm text-gray-500">İptal</button>
            </div>
          </form>
        </div>
      </DoctorLayout>
    )
  }

  // ─── DETAIL VIEW ───────────────────────────────────────────────────────────
  const cfg = selectedInvoice ? (STATUS_CFG[selectedInvoice.status] ?? STATUS_CFG.Draft) : STATUS_CFG.Draft
  const backBtn2 = (
    <div className="flex items-center gap-2">
      <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Geri
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-teal-700 border border-gray-200 rounded-xl px-3 py-1.5 hover:border-teal-300 transition-colors"
      >
        <Printer size={14} /> PDF İndir
      </button>
    </div>
  )
  return (
    <DoctorLayout title="Fatura Detayı" action={backBtn2}>
      <style>{`
        @media print {
          nav, header, aside, [data-no-print] { display: none !important; }
          body { background: white !important; }
          .print-invoice { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="max-w-2xl">
        {selectedInvoice && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm print-invoice">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="font-mono font-bold text-gray-800">{selectedInvoice.invoiceNumber}</p>
                <p className="text-xs text-gray-400 mt-1">{dayjs(selectedInvoice.createdAt).format('DD MMMM YYYY')}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-xl font-semibold border ${cfg.cls}`}>
                {cfg.label}
              </span>
            </div>

            {/* Items table */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Hizmet</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Adet</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Birim</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items ?? []).map((item: any) => (
                    <tr key={item.id} className="border-t border-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{item.serviceName}</td>
                      <td className="text-right px-4 py-2.5 text-gray-600">{item.quantity}</td>
                      <td className="text-right px-4 py-2.5 text-gray-600">₺{item.unitPrice?.toFixed(2)}</td>
                      <td className="text-right px-4 py-2.5 font-semibold text-gray-800">₺{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="text-right text-sm space-y-1 mb-5">
              <p className="text-gray-400">Ara Toplam: ₺{selectedInvoice.subTotal?.toFixed(2)}</p>
              {selectedInvoice.discountAmount > 0 && (
                <p className="text-red-500">İndirim: -₺{selectedInvoice.discountAmount?.toFixed(2)}</p>
              )}
              <p className="text-xl font-bold text-gray-900">₺{selectedInvoice.totalAmount?.toFixed(2)}</p>
            </div>

            {/* Payments history */}
            {(selectedInvoice.payments ?? []).length > 0 && (
              <div className="mb-5 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <h3 className="font-semibold text-emerald-800 text-sm mb-2">Ödemeler</h3>
                {selectedInvoice.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm py-1 border-b border-emerald-100 last:border-0">
                    <span className="text-emerald-700">{p.method} — {dayjs(p.paidAt).format('DD MMM YYYY')}</span>
                    <span className="font-bold text-emerald-800">₺{p.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {selectedInvoice.status === 'Draft' && (
                <button
                  onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'Issued' })}
                  disabled={statusMutation.isPending}
                  className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
                >
                  Faturayı Kes
                </button>
              )}
              {selectedInvoice.status === 'Issued' && (
                <>
                  <button
                    onClick={() => setShowPayment(v => !v)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700"
                  >
                    Ödeme Al
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'Cancelled' })}
                    disabled={statusMutation.isPending}
                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60"
                  >
                    İptal Et
                  </button>
                </>
              )}
            </div>

            {/* Payment form */}
            {showPayment && (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  paymentMutation.mutate({
                    id: selectedInvoice.id,
                    data: { amount: parseFloat(paymentForm.amount), method: paymentForm.method, note: paymentForm.note },
                  })
                }}
                className="mt-4 bg-emerald-50 rounded-2xl p-4 border border-emerald-200"
              >
                <h3 className="font-semibold text-emerald-800 mb-3 text-sm">Ödeme Bilgisi</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tutar (₺)</label>
                    <input type="number" step="0.01" value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Yöntem</label>
                    <select value={paymentForm.method}
                      onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                      className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="Cash">Nakit</option>
                      <option value="CreditCard">Kredi Kartı</option>
                      <option value="BankTransfer">Havale</option>
                      <option value="Insurance">Sigorta</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">Not</label>
                  <input type="text" value={paymentForm.note}
                    onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button type="submit" disabled={paymentMutation.isPending}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
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
    </DoctorLayout>
  )
}
