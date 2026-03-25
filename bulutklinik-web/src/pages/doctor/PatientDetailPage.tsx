import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { medicalApi } from '../../services/medicalApi'
import { patientApi } from '../../services/patientApi'
import { getDoctorAppointments } from '../../services/appointmentApi'
import { sessionsForPatient, type AnalysisSession } from '../../services/sessionStore'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  ClipboardList, FileText, BarChart2, FolderOpen, Bell, CalendarDays,
  ArrowLeft, Plus, CheckCircle2, Send, Activity, ChevronDown, ChevronUp, ScanFace,
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

// ─── Types ────────────────────────────────────────────────────────────────── //

type Tab = 'records' | 'history' | 'measurements' | 'appointments' | 'documents' | 'notifications' | 'journey'
type JourneyFilter = 'all' | 'record' | 'ai_session' | 'document' | 'measurement'

interface RecordData {
  id: string; createdAt: string; chiefComplaint?: string
  diagnosis?: string; treatmentPlan?: string; icdCode?: string; findings?: string
}
interface MeasurementData {
  id: string; measuredAt: string; type: string; value: number; unit: string
}
interface DocumentData {
  id: string; uploadedAt: string; title: string; category: string
  fileUrl?: string; notes?: string
}
interface HistoryData {
  chronicDiseases?: string; allergies?: string; bloodType?: string
}

type TimelineItem =
  | { id: string; type: 'record';      timestamp: number; data: RecordData }
  | { id: string; type: 'ai_session';  timestamp: number; data: AnalysisSession }
  | { id: string; type: 'document';    timestamp: number; data: DocumentData }
  | { id: string; type: 'measurement'; timestamp: number; data: MeasurementData }
  | { id: string; type: 'history';     timestamp: number; data: HistoryData }

// ─── Config ───────────────────────────────────────────────────────────────── //

const TAB_CFG: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: 'records',       label: 'Muayene',    Icon: ClipboardList },
  { key: 'history',       label: 'Özgeçmiş',   Icon: FileText },
  { key: 'measurements',  label: 'Ölçümler',   Icon: BarChart2 },
  { key: 'documents',     label: 'Dokümanlar', Icon: FolderOpen },
  { key: 'notifications', label: 'Bildirimler',Icon: Bell },
  { key: 'appointments',  label: 'Randevular', Icon: CalendarDays },
  { key: 'journey',       label: 'Yolculuk',   Icon: Activity },
]

const STATUS_CFG = {
  Confirmed: { label: 'Onaylı',     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  Pending:   { label: 'Beklemede',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  Cancelled: { label: 'İptal',      cls: 'text-red-600 bg-red-50 border-red-200' },
  Completed: { label: 'Tamamlandı', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
} as const

const DOC_CATEGORIES: Record<string, string> = {
  LabResult: 'Lab Sonucu', Prescription: 'Reçete', Imaging: 'Görüntüleme',
  Referral: 'Sevk', Consent: 'Onam', Other: 'Diğer',
}

const MTYPE_ICONS: Record<string, string> = {
  BloodPressure: '🩺', HeartRate: '❤️', BloodSugar: '🩸',
  Weight: '⚖️', Height: '📏', Temperature: '🌡️', OxygenSaturation: '💨',
}

const JOURNEY_TYPE_CFG: Record<TimelineItem['type'], {
  label: string; emoji: string; iconBg: string; iconText: string; borderColor: string
}> = {
  record:      { label: 'Muayene Kaydı',   emoji: '📋', iconBg: 'bg-teal-50',   iconText: 'text-teal-600',   borderColor: 'border-teal-200' },
  ai_session:  { label: 'AI Analiz Seansı',emoji: '📸', iconBg: 'bg-purple-50', iconText: 'text-purple-600', borderColor: 'border-purple-200' },
  document:    { label: 'Belge Yükleme',   emoji: '📄', iconBg: 'bg-blue-50',   iconText: 'text-blue-600',   borderColor: 'border-blue-200' },
  measurement: { label: 'Ölçüm',           emoji: '💊', iconBg: 'bg-amber-50',  iconText: 'text-amber-600',  borderColor: 'border-amber-200' },
  history:     { label: 'Tıbbi Özgeçmiş',  emoji: '📁', iconBg: 'bg-emerald-50',iconText: 'text-emerald-600',borderColor: 'border-emerald-200' },
}

const JOURNEY_FILTERS: { key: JourneyFilter; label: string }[] = [
  { key: 'all',         label: 'Tümü' },
  { key: 'record',      label: 'Muayene' },
  { key: 'ai_session',  label: 'AI Analiz' },
  { key: 'document',    label: 'Belge' },
  { key: 'measurement', label: 'Ölçüm' },
]

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

// ─── Component ────────────────────────────────────────────────────────────── //

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { userId } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('records')
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [selectedAptId, setSelectedAptId] = useState('')
  const [recordForm, setRecordForm] = useState({
    chiefComplaint: '', findings: '', diagnosis: '', treatmentPlan: '', icdCode: '',
  })
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ title: '', category: 'LabResult', fileUrl: '', notes: '' })
  const [notifForm, setNotifForm] = useState({ message: '', channel: 'SMS' })

  // Journey state
  const [journeyItems, setJourneyItems] = useState<TimelineItem[]>([])
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>('all')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => { document.title = 'Hasta Detayı – Medica.AI' }, [])

  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['patient-records', patientId],
    queryFn: () => medicalApi.getRecords(patientId!),
    enabled: !!patientId,
  })

  const { data: history } = useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: () => medicalApi.getHistory(patientId!),
    enabled: !!patientId,
  })

  const { data: measurements = [], isLoading: loadingMeasurements } = useQuery({
    queryKey: ['patient-measurements', patientId],
    queryFn: () => medicalApi.getMeasurements(patientId!),
    enabled: !!patientId,
  })

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => patientApi.getDocuments(patientId!),
    enabled: !!patientId && tab === 'documents',
  })

  const { data: notifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['patient-notifications', patientId],
    queryFn: () => patientApi.getNotifications(patientId!),
    enabled: !!patientId && tab === 'notifications',
  })

  const { data: appointments = [] } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // Journey: load all sources with Promise.allSettled
  useEffect(() => {
    if (tab !== 'journey' || !patientId) return
    let cancelled = false
    setJourneyLoading(true)

    const fetchAll = async () => {
      const [recRes, measRes, docRes, sessRes, histRes] = await Promise.allSettled([
        medicalApi.getRecords(patientId),
        medicalApi.getMeasurements(patientId),
        patientApi.getDocuments(patientId),
        sessionsForPatient(Number(patientId)),
        medicalApi.getHistory(patientId),
      ])
      if (cancelled) return

      const items: TimelineItem[] = []

      if (recRes.status === 'fulfilled') {
        ;(recRes.value as RecordData[]).forEach(r => {
          items.push({ id: `record-${r.id}`, type: 'record', timestamp: new Date(r.createdAt).getTime(), data: r })
        })
      }
      if (measRes.status === 'fulfilled') {
        ;(measRes.value as MeasurementData[]).forEach(m => {
          items.push({ id: `measurement-${m.id}`, type: 'measurement', timestamp: new Date(m.measuredAt).getTime(), data: m })
        })
      }
      if (docRes.status === 'fulfilled') {
        ;(docRes.value as DocumentData[]).forEach(d => {
          items.push({ id: `document-${d.id}`, type: 'document', timestamp: new Date(d.uploadedAt).getTime(), data: d })
        })
      }
      if (sessRes.status === 'fulfilled') {
        ;(sessRes.value as AnalysisSession[]).forEach(s => {
          items.push({ id: `session-${s.id}`, type: 'ai_session', timestamp: s.createdAt, data: s })
        })
      }
      if (histRes.status === 'fulfilled' && histRes.value) {
        items.push({ id: 'history-entry', type: 'history', timestamp: 0, data: histRes.value as HistoryData })
      }

      items.sort((a, b) => b.timestamp - a.timestamp)
      setJourneyItems(items)
      setJourneyLoading(false)
    }

    fetchAll().catch(() => setJourneyLoading(false))
    return () => { cancelled = true }
  }, [tab, patientId])

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredJourneyItems = journeyFilter === 'all'
    ? journeyItems
    : journeyItems.filter(item => item.type === journeyFilter)

  const patientApts = (appointments as Record<string, unknown>[]).filter(
    (a: Record<string, unknown>) => a.patientId === patientId
  )
  const completedApts = patientApts.filter((a: Record<string, unknown>) => a.status === 'Completed')
  const patientEmail = (patientApts[0] as Record<string, unknown> | undefined)?.patientEmail as string
    ?? (patientId?.slice(0, 8) + '...')
  const initials = patientEmail.charAt(0).toUpperCase()

  const addRecordMutation = useMutation({
    mutationFn: ({ aptId, data }: { aptId: string; data: object }) =>
      medicalApi.createRecord(aptId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-records'] })
      setShowRecordForm(false)
      setRecordForm({ chiefComplaint: '', findings: '', diagnosis: '', treatmentPlan: '', icdCode: '' })
      setSelectedAptId('')
    },
  })

  const uploadDocMutation = useMutation({
    mutationFn: (data: object) => patientApi.uploadDocument(patientId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-documents'] })
      setShowDocForm(false)
      setDocForm({ title: '', category: 'LabResult', fileUrl: '', notes: '' })
    },
  })

  const sendNotifMutation = useMutation({
    mutationFn: (data: object) => patientApi.sendNotification(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-notifications'] })
      setNotifForm({ message: '', channel: 'SMS' })
    },
  })

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAptId || !recordForm.chiefComplaint) return
    addRecordMutation.mutate({ aptId: selectedAptId, data: { ...recordForm, doctorId: userId } })
  }

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docForm.title || !docForm.fileUrl) return
    uploadDocMutation.mutate(docForm)
  }

  const handleNotifSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!notifForm.message) return
    sendNotifMutation.mutate({ message: notifForm.message, channel: notifForm.channel, patientId })
  }

  const backBtn = (
    <button
      onClick={() => navigate('/doctor/patients')}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
    >
      <ArrowLeft size={16} /> Geri
    </button>
  )

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  return (
    <DoctorLayout title="Hasta Detayı" action={backBtn}>
      <div className="max-w-4xl space-y-5">

        {/* Patient header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{patientEmail}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{patientId}</p>
          </div>
          <div className="flex gap-4 text-center flex-shrink-0">
            <div>
              <p className="text-lg font-bold text-teal-600">{patientApts.length}</p>
              <p className="text-[10px] text-gray-400">randevu</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{(records as unknown[]).length}</p>
              <p className="text-[10px] text-gray-400">muayene</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600">{completedApts.length}</p>
              <p className="text-[10px] text-gray-400">tamamlanan</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
          {TAB_CFG.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                tab === key
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Muayene Kayıtları ── */}
        {tab === 'records' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-700">Muayene Kayıtları</h2>
              <button
                onClick={() => setShowRecordForm(v => !v)}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus size={14} /> Muayene Ekle
              </button>
            </div>

            {showRecordForm && (
              <form onSubmit={handleRecordSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Yeni Muayene Kaydı</h3>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Randevu Seç *</label>
                  <select value={selectedAptId} onChange={e => setSelectedAptId(e.target.value)} className={inputCls}>
                    <option value="">Randevu seçin</option>
                    {completedApts.map((a: Record<string, unknown>) => (
                      <option key={a.id as string} value={a.id as string}>
                        {a.appointmentDate as string} {(a.startTime as string)?.slice(0, 5)} — {a.type as string}
                      </option>
                    ))}
                    {completedApts.length === 0 && <option disabled>Tamamlanmış randevu yok</option>}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Şikayet *</label>
                    <input type="text" value={recordForm.chiefComplaint}
                      onChange={e => setRecordForm(f => ({ ...f, chiefComplaint: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Bulgular</label>
                    <textarea rows={2} value={recordForm.findings}
                      onChange={e => setRecordForm(f => ({ ...f, findings: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tanı</label>
                    <input type="text" value={recordForm.diagnosis}
                      onChange={e => setRecordForm(f => ({ ...f, diagnosis: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ICD Kodu</label>
                    <input type="text" placeholder="ör. J06.9" value={recordForm.icdCode}
                      onChange={e => setRecordForm(f => ({ ...f, icdCode: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Tedavi Planı</label>
                    <textarea rows={2} value={recordForm.treatmentPlan}
                      onChange={e => setRecordForm(f => ({ ...f, treatmentPlan: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={addRecordMutation.isPending}
                    className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    {addRecordMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button type="button" onClick={() => setShowRecordForm(false)}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">İptal</button>
                </div>
              </form>
            )}

            {loadingRecords && (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
              </div>
            )}
            {!loadingRecords && (records as unknown[]).length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                <ClipboardList size={32} className="mx-auto mb-2 text-gray-200" />
                Henüz muayene kaydı yok.
              </div>
            )}
            <div className="space-y-3">
              {(records as RecordData[]).map(r => (
                <article key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs text-gray-400">{dayjs(r.createdAt).format('DD MMMM YYYY')}</p>
                    {r.icdCode && (
                      <span className="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                        {r.icdCode}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    {r.chiefComplaint && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium w-20 flex-shrink-0">Şikayet</span>
                        <span className="text-gray-700">{r.chiefComplaint}</span>
                      </div>
                    )}
                    {r.findings && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium w-20 flex-shrink-0">Bulgular</span>
                        <span className="text-gray-700">{r.findings}</span>
                      </div>
                    )}
                    {r.diagnosis && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium w-20 flex-shrink-0">Tanı</span>
                        <span className="text-gray-900 font-semibold">{r.diagnosis}</span>
                      </div>
                    )}
                    {r.treatmentPlan && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium w-20 flex-shrink-0">Tedavi</span>
                        <span className="text-gray-700">{r.treatmentPlan}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ── Tıbbi Özgeçmiş ── */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Tıbbi Özgeçmiş</h2>
            {!history ? (
              <div className="text-center py-8">
                <FileText size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">Özgeçmiş kaydı bulunmuyor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Kronik Hastalıklar',    value: (history as Record<string, unknown>).chronicDiseases },
                  { label: 'Alerjiler',              value: (history as Record<string, unknown>).allergies },
                  { label: 'Aile Öyküsü',            value: (history as Record<string, unknown>).familyHistory },
                  { label: 'Geçirilmiş Ameliyatlar', value: (history as Record<string, unknown>).previousSurgeries },
                  { label: 'Kullanılan İlaçlar',     value: (history as Record<string, unknown>).currentMedications },
                  { label: 'Kan Grubu',              value: (history as Record<string, unknown>).bloodType },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1 font-medium">{label}</p>
                    <p className="text-gray-800 font-semibold">{(value as string) || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Ölçümler ── */}
        {tab === 'measurements' && (
          <div>
            {loadingMeasurements && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
              </div>
            )}
            {!loadingMeasurements && (measurements as unknown[]).length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <BarChart2 size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400">Ölçüm kaydı yok.</p>
              </div>
            )}
            <div className="space-y-2.5">
              {(measurements as MeasurementData[]).map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{MTYPE_ICONS[m.type] ?? '📊'}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{m.type}</p>
                      <p className="text-xs text-gray-400">{dayjs(m.measuredAt).format('DD MMM YYYY HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-teal-700">{m.value}</p>
                    <p className="text-xs text-gray-400">{m.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dokümanlar ── */}
        {tab === 'documents' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-700">Dokümanlar</h2>
              <button
                onClick={() => setShowDocForm(v => !v)}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus size={14} /> Doküman Ekle
              </button>
            </div>

            {showDocForm && (
              <form onSubmit={handleDocSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Yeni Doküman</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Başlık *</label>
                    <input type="text" value={docForm.title}
                      onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                    <select value={docForm.category}
                      onChange={e => setDocForm(f => ({ ...f, category: e.target.value }))}
                      className={inputCls}>
                      {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Dosya URL *</label>
                    <input type="text" placeholder="https://..." value={docForm.fileUrl}
                      onChange={e => setDocForm(f => ({ ...f, fileUrl: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Not</label>
                    <input type="text" value={docForm.notes}
                      onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={uploadDocMutation.isPending}
                    className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                    {uploadDocMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button type="button" onClick={() => setShowDocForm(false)}
                    className="px-4 py-2 text-sm text-gray-500">İptal</button>
                </div>
              </form>
            )}

            {loadingDocs && <div className="h-20 animate-pulse bg-white rounded-2xl border border-gray-100" />}
            {!loadingDocs && (documents as unknown[]).length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <FolderOpen size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400">Doküman bulunamadı.</p>
              </div>
            )}
            <div className="space-y-2.5">
              {(documents as DocumentData[]).map(d => (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FolderOpen size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{d.title}</p>
                      <p className="text-xs text-gray-400">
                        {DOC_CATEGORIES[d.category] ?? d.category} · {dayjs(d.uploadedAt).format('DD MMM YYYY')}
                      </p>
                      {d.notes && <p className="text-xs text-gray-500 mt-0.5">{d.notes}</p>}
                    </div>
                  </div>
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-teal-600 text-sm font-semibold hover:underline flex-shrink-0">
                      İndir
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bildirimler ── */}
        {tab === 'notifications' && (
          <div>
            <form onSubmit={handleNotifSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 text-sm mb-3">Bildirim Gönder</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Kanal</label>
                  <select value={notifForm.channel}
                    onChange={e => setNotifForm(f => ({ ...f, channel: e.target.value }))}
                    className={inputCls}>
                    <option value="SMS">SMS</option>
                    <option value="Email">E-posta</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Mesaj *</label>
                  <textarea rows={2} value={notifForm.message}
                    onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Mesajınızı yazın..."
                    className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button type="submit" disabled={sendNotifMutation.isPending}
                  className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                  <Send size={14} />
                  {sendNotifMutation.isPending ? 'Gönderiliyor...' : 'Gönder'}
                </button>
                {sendNotifMutation.isSuccess && (
                  <span className="text-emerald-600 text-sm flex items-center gap-1">
                    <CheckCircle2 size={14} /> Gönderildi
                  </span>
                )}
              </div>
            </form>

            {loadingNotifs && <div className="h-16 animate-pulse bg-white rounded-2xl border border-gray-100" />}
            {!loadingNotifs && (notifications as unknown[]).length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Bell size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400">Bildirim geçmişi yok.</p>
              </div>
            )}
            <div className="space-y-2.5">
              {(notifications as Record<string, unknown>[]).map((n) => (
                <div key={n.id as string} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm text-gray-800 flex-1">{n.message as string}</p>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{n.channel as string}</span>
                      <p className="text-xs text-gray-400 mt-1">{dayjs(n.sentAt as string).format('DD MMM YYYY HH:mm')}</p>
                      {n.isSuccess === true && (
                        <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-0.5 justify-end">
                          <CheckCircle2 size={10} /> İletildi
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Randevular ── */}
        {tab === 'appointments' && (
          <div>
            {patientApts.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <CalendarDays size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400">Randevu bulunamadı.</p>
              </div>
            )}
            <div className="space-y-2.5">
              {patientApts.map((a: Record<string, unknown>) => {
                const cfg = STATUS_CFG[a.status as keyof typeof STATUS_CFG]
                  ?? { label: a.status as string, cls: 'text-gray-600 bg-gray-50 border-gray-200' }
                return (
                  <div key={a.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {dayjs(a.appointmentDate as string).format('DD MMMM YYYY')} · {(a.startTime as string)?.slice(0, 5)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.type === 'Online' ? '💻 Online' : '🏥 Yüz Yüze'}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Hasta Yolculuğu Timeline ── */}
        {tab === 'journey' && (
          <div>
            {/* Filtre butonları */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {JOURNEY_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setJourneyFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    journeyFilter === f.key
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600'
                  }`}
                >
                  {f.label}
                  {f.key !== 'all' && (
                    <span className="ml-1 opacity-60">
                      ({journeyItems.filter(i => i.type === f.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Yükleniyor */}
            {journeyLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full animate-pulse bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 h-20 animate-pulse bg-white rounded-2xl border border-gray-100" />
                  </div>
                ))}
              </div>
            )}

            {/* Boş durum */}
            {!journeyLoading && filteredJourneyItems.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Activity size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-600 font-semibold mb-1">Henüz kayıt yok</p>
                <p className="text-gray-400 text-sm">
                  Bu hasta için seçili kategoride herhangi bir olay kaydı bulunmuyor.
                </p>
              </div>
            )}

            {/* Timeline */}
            {!journeyLoading && filteredJourneyItems.length > 0 && (
              <div className="relative">
                {/* Dikey çizgi */}
                <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100 rounded-full" />

                <div className="space-y-3">
                  {filteredJourneyItems.map((item) => {
                    const cfg = JOURNEY_TYPE_CFG[item.type]
                    const isExpanded = expandedItems.has(item.id)
                    const dateStr = item.timestamp > 0
                      ? dayjs(item.timestamp).format('DD MMMM YYYY, HH:mm')
                      : 'Tarih bilinmiyor'

                    return (
                      <div key={item.id} className="flex gap-4 relative">
                        {/* Icon dot */}
                        <div className={`w-10 h-10 rounded-full ${cfg.iconBg} border-2 ${cfg.borderColor} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                          {item.type === 'ai_session' ? (
                            <ScanFace size={16} className={cfg.iconText} />
                          ) : (
                            <span className="text-base leading-none">{cfg.emoji}</span>
                          )}
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          {/* Card header */}
                          <div className="flex items-start justify-between gap-3 p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.iconBg} ${cfg.iconText} ${cfg.borderColor}`}>
                                  {cfg.label}
                                </span>
                                {/* AI skor badge */}
                                {item.type === 'ai_session' && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreColor(item.data.symmetryScore)}`}>
                                    Skor: {item.data.symmetryScore}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
                              {/* Kısa özet */}
                              <p className="text-sm text-gray-700 font-medium mt-1.5 line-clamp-1">
                                {item.type === 'record' && (
                                  item.data.chiefComplaint
                                    ? `Şikayet: ${item.data.chiefComplaint}`
                                    : item.data.diagnosis ?? 'Muayene kaydı'
                                )}
                                {item.type === 'measurement' && `${MTYPE_ICONS[item.data.type] ?? '📊'} ${item.data.type}: ${item.data.value} ${item.data.unit}`}
                                {item.type === 'document' && `${item.data.title} — ${DOC_CATEGORIES[item.data.category] ?? item.data.category}`}
                                {item.type === 'ai_session' && item.data.label}
                                {item.type === 'history' && 'Tıbbi özgeçmiş kaydı'}
                              </p>
                            </div>

                            {/* Thumbnail (AI seans) */}
                            {item.type === 'ai_session' && item.data.thumbnailB64 && (
                              <img
                                src={item.data.thumbnailB64}
                                alt="AI analiz görseli"
                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-purple-100"
                              />
                            )}

                            {/* Expand button */}
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors flex-shrink-0"
                              aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50">
                              {item.type === 'record' && (
                                <div className="space-y-1.5 text-sm">
                                  {item.data.chiefComplaint && <p><span className="text-gray-400 text-xs font-medium">Şikayet:</span> <span className="text-gray-700">{item.data.chiefComplaint}</span></p>}
                                  {item.data.findings && <p><span className="text-gray-400 text-xs font-medium">Bulgular:</span> <span className="text-gray-700">{item.data.findings}</span></p>}
                                  {item.data.diagnosis && <p><span className="text-gray-400 text-xs font-medium">Tanı:</span> <span className="text-gray-800 font-semibold">{item.data.diagnosis}</span></p>}
                                  {item.data.icdCode && <p><span className="text-gray-400 text-xs font-medium">ICD:</span> <span className="font-mono text-blue-700">{item.data.icdCode}</span></p>}
                                  {item.data.treatmentPlan && <p><span className="text-gray-400 text-xs font-medium">Tedavi Planı:</span> <span className="text-gray-700">{item.data.treatmentPlan}</span></p>}
                                </div>
                              )}
                              {item.type === 'measurement' && (
                                <div className="flex items-center gap-6 text-sm">
                                  <div>
                                    <p className="text-xs text-gray-400">Değer</p>
                                    <p className="text-xl font-bold text-teal-700">{item.data.value} <span className="text-sm font-normal text-gray-400">{item.data.unit}</span></p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Ölçüm Tipi</p>
                                    <p className="font-semibold text-gray-800">{item.data.type}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Tarih</p>
                                    <p className="font-semibold text-gray-800">{dayjs(item.data.measuredAt).format('DD MMM YYYY HH:mm')}</p>
                                  </div>
                                </div>
                              )}
                              {item.type === 'document' && (
                                <div className="space-y-1 text-sm">
                                  <p><span className="text-gray-400 text-xs font-medium">Kategori:</span> <span className="text-gray-700">{DOC_CATEGORIES[item.data.category] ?? item.data.category}</span></p>
                                  {item.data.notes && <p><span className="text-gray-400 text-xs font-medium">Not:</span> <span className="text-gray-700">{item.data.notes}</span></p>}
                                  {item.data.fileUrl && (
                                    <a href={item.data.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-teal-600 font-semibold text-xs hover:underline mt-1">
                                      Dosyayı Görüntüle →
                                    </a>
                                  )}
                                </div>
                              )}
                              {item.type === 'ai_session' && (
                                <div className="space-y-2 text-sm">
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                                      <p className="text-xs text-gray-400">Simetri</p>
                                      <p className={`text-lg font-bold ${item.data.symmetryScore >= 80 ? 'text-emerald-600' : item.data.symmetryScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {item.data.symmetryScore}
                                      </p>
                                    </div>
                                    <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                                      <p className="text-xs text-gray-400">Kaş Δ</p>
                                      <p className="text-lg font-bold text-gray-800">{item.data.eyebrowDeltaMm.toFixed(1)} mm</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                                      <p className="text-xs text-gray-400">Dudak Δ</p>
                                      <p className="text-lg font-bold text-gray-800">{item.data.lipDeltaMm.toFixed(1)} mm</p>
                                    </div>
                                  </div>
                                  {item.data.plan && (
                                    <p className="text-xs text-gray-500 italic">
                                      {item.data.plan.clinical_summary?.slice(0, 120)}
                                      {(item.data.plan.clinical_summary?.length ?? 0) > 120 ? '...' : ''}
                                    </p>
                                  )}
                                </div>
                              )}
                              {item.type === 'history' && (
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {item.data.chronicDiseases && (
                                    <div><p className="text-xs text-gray-400">Kronik Hastalıklar</p><p className="text-gray-700">{item.data.chronicDiseases}</p></div>
                                  )}
                                  {item.data.allergies && (
                                    <div><p className="text-xs text-gray-400">Alerjiler</p><p className="text-gray-700">{item.data.allergies}</p></div>
                                  )}
                                  {item.data.bloodType && (
                                    <div><p className="text-xs text-gray-400">Kan Grubu</p><p className="text-gray-700 font-bold">{item.data.bloodType}</p></div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </DoctorLayout>
  )
}
