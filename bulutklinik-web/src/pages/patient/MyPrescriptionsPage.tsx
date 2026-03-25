import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { patientApi } from '../../services/patientApi'
import PatientLayout from '../../components/patient/PatientLayout'
import { Download, Pill, FlaskConical, Scan, FolderOpen, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
dayjs.locale('tr')

type DocTab = 'all' | 'prescriptions' | 'lab' | 'imaging'

const TABS: { key: DocTab; label: string; Icon: React.ElementType; category?: string }[] = [
  { key: 'all',           label: 'Tümü',        Icon: FolderOpen },
  { key: 'prescriptions', label: 'Reçeteler',   Icon: Pill,         category: 'Prescription' },
  { key: 'lab',           label: 'Tahliller',   Icon: FlaskConical, category: 'LabResult' },
  { key: 'imaging',       label: 'Görüntüleme', Icon: Scan,         category: 'Imaging' },
]

const CAT_CFG: Record<string, { label: string; Icon: React.ElementType; cls: string; iconCls: string }> = {
  Prescription: { label: 'Reçete',      Icon: Pill,         cls: 'text-green-700 bg-green-50 border-green-100',   iconCls: 'bg-green-100 text-green-600' },
  LabResult:    { label: 'Tahlil',      Icon: FlaskConical, cls: 'text-blue-700 bg-blue-50 border-blue-100',      iconCls: 'bg-blue-100 text-blue-600' },
  Imaging:      { label: 'Görüntüleme', Icon: Scan,         cls: 'text-purple-700 bg-purple-50 border-purple-100', iconCls: 'bg-purple-100 text-purple-600' },
  Referral:     { label: 'Sevk',        Icon: FileText,     cls: 'text-orange-700 bg-orange-50 border-orange-100', iconCls: 'bg-orange-100 text-orange-600' },
  Other:        { label: 'Diğer',       Icon: FileText,     cls: 'text-gray-600 bg-gray-50 border-gray-200',       iconCls: 'bg-gray-100 text-gray-500' },
}

function DocSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded-lg w-40" />
        <div className="h-3 bg-gray-100 rounded-lg w-24" />
      </div>
    </div>
  )
}

export default function MyPrescriptionsPage() {
  const { userId } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DocTab>('all')

  useEffect(() => { document.title = 'Belgelerim – Medica.AI' }, [])

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['my-documents', userId],
    queryFn: () => patientApi.getDocuments(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const allDocs = docs as any[]
  const tabDef = TABS.find(t => t.key === activeTab)!

  const filtered = tabDef.category
    ? allDocs.filter(d => d.category === tabDef.category)
    : allDocs

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.category ? allDocs.filter(d => d.category === t.category).length : allDocs.length
    return acc
  }, {} as Record<DocTab, number>)

  return (
    <PatientLayout title="Belgelerim">
      <div className="max-w-2xl">

        {/* Tabs */}
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 mb-5">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {counts[key] > 0 && (
                <span className={`text-xs font-bold ${activeTab === key ? 'text-blue-600' : 'text-gray-400'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <DocSkeleton key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <tabDef.Icon size={28} className="text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">
              {activeTab === 'prescriptions' && 'Henüz reçete bulunmuyor'}
              {activeTab === 'lab'           && 'Henüz tahlil sonucu bulunmuyor'}
              {activeTab === 'imaging'       && 'Henüz görüntüleme belgesi bulunmuyor'}
              {activeTab === 'all'           && 'Henüz belge bulunmuyor'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Belgeleriniz doktorunuz tarafından yüklendiğinde burada görünecek.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d: any) => {
              const cfg = CAT_CFG[d.category] ?? CAT_CFG.Other
              const { Icon: CatIcon } = cfg
              return (
                <article key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconCls}`}>
                    <CatIcon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{d.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-400">{dayjs(d.uploadedAt).format('DD MMM YYYY')}</span>
                    </div>
                    {d.notes && <p className="text-xs text-gray-400 mt-1 truncate">{d.notes}</p>}
                  </div>
                  {d.fileUrl && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-colors"
                      aria-label={`${d.title} dosyasını indir`}
                    >
                      <Download size={13} /> İndir
                    </a>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </PatientLayout>
  )
}
