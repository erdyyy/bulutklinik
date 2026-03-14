import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { medicalApi } from '../../services/medicalApi'
import { getDoctorAppointments } from '../../services/appointmentApi'
import Navbar from '../../components/shared/Navbar'
import StatusBadge from '../../components/shared/StatusBadge'
import dayjs from 'dayjs'

type Tab = 'history' | 'records' | 'measurements' | 'appointments'

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { userId } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('records')
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [selectedAptId, setSelectedAptId] = useState('')
  const [recordForm, setRecordForm] = useState({
    chiefComplaint: '', findings: '', diagnosis: '', treatmentPlan: '', icdCode: '',
  })

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

  const { data: appointments = [] } = useQuery({
    queryKey: ['doctor-appointments', userId],
    queryFn: () => getDoctorAppointments(userId!),
    enabled: !!userId,
  })

  const patientAppointments = (appointments as any[]).filter(
    (a: any) => a.patientId === patientId
  )

  const completedApts = patientAppointments.filter((a: any) => a.status === 'Completed')

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

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAptId || !recordForm.chiefComplaint) return
    addRecordMutation.mutate({
      aptId: selectedAptId,
      data: { ...recordForm, doctorId: userId },
    })
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'records', label: 'Muayene', icon: '📋' },
    { key: 'history', label: 'Özgeçmiş', icon: '📄' },
    { key: 'measurements', label: 'Ölçümler', icon: '📊' },
    { key: 'appointments', label: 'Randevular', icon: '📅' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Başlık */}
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
            👤
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono">Hasta ID: {patientId}</p>
            <p className="text-sm text-gray-500 mt-0.5">{patientAppointments.length} randevu · {records.length} muayene kaydı</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Muayene Kayıtları */}
        {tab === 'records' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-700">Muayene Kayıtları</h2>
              <button
                onClick={() => setShowRecordForm(v => !v)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Muayene Ekle
              </button>
            </div>

            {showRecordForm && (
              <form onSubmit={handleRecordSubmit} className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
                <h3 className="font-medium text-gray-700 mb-4">Yeni Muayene Kaydı</h3>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">Randevu Seç *</label>
                  <select
                    value={selectedAptId}
                    onChange={e => setSelectedAptId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Randevu seçin</option>
                    {completedApts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.appointmentDate} {a.startTime?.slice(0, 5)} — {a.type}
                      </option>
                    ))}
                    {completedApts.length === 0 && (
                      <option disabled value="">Tamamlanmış randevu yok</option>
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Şikayet *</label>
                    <input
                      type="text"
                      value={recordForm.chiefComplaint}
                      onChange={e => setRecordForm(f => ({ ...f, chiefComplaint: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Hastanın şikayeti"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Bulgular</label>
                    <textarea
                      rows={2}
                      value={recordForm.findings}
                      onChange={e => setRecordForm(f => ({ ...f, findings: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Tanı</label>
                      <input
                        type="text"
                        value={recordForm.diagnosis}
                        onChange={e => setRecordForm(f => ({ ...f, diagnosis: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">ICD Kodu</label>
                      <input
                        type="text"
                        value={recordForm.icdCode}
                        onChange={e => setRecordForm(f => ({ ...f, icdCode: e.target.value }))}
                        placeholder="ör. J06.9"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tedavi Planı</label>
                    <textarea
                      rows={2}
                      value={recordForm.treatmentPlan}
                      onChange={e => setRecordForm(f => ({ ...f, treatmentPlan: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={addRecordMutation.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                  >
                    {addRecordMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button type="button" onClick={() => setShowRecordForm(false)} className="px-4 py-2 text-sm text-gray-500">
                    İptal
                  </button>
                </div>
              </form>
            )}

            {loadingRecords && <p className="text-gray-500">Yükleniyor...</p>}
            {!loadingRecords && records.length === 0 && (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Henüz muayene kaydı yok.</div>
            )}
            <div className="space-y-4">
              {(records as any[]).map(r => (
                <div key={r.id} className="bg-white rounded-xl border p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-sm text-gray-500">{dayjs(r.createdAt).format('DD MMM YYYY')}</p>
                    {r.icdCode && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-1 rounded">{r.icdCode}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div><span className="font-medium text-gray-600">Şikayet:</span> <span className="text-gray-800">{r.chiefComplaint}</span></div>
                    {r.findings && <div><span className="font-medium text-gray-600">Bulgular:</span> <span className="text-gray-800">{r.findings}</span></div>}
                    {r.diagnosis && <div><span className="font-medium text-gray-600">Tanı:</span> <span className="text-gray-800 font-semibold">{r.diagnosis}</span></div>}
                    {r.treatmentPlan && <div><span className="font-medium text-gray-600">Tedavi:</span> <span className="text-gray-800">{r.treatmentPlan}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hasta Özgeçmişi */}
        {tab === 'history' && (
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Tıbbi Özgeçmiş</h2>
            {!history ? (
              <p className="text-gray-400 text-sm">Özgeçmiş kaydı bulunmuyor.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Kronik Hastalıklar', value: history.chronicDiseases },
                  { label: 'Alerjiler', value: history.allergies },
                  { label: 'Aile Öyküsü', value: history.familyHistory },
                  { label: 'Geçirilmiş Ameliyatlar', value: history.previousSurgeries },
                  { label: 'Kullanılan İlaçlar', value: history.currentMedications },
                  { label: 'Kan Grubu', value: history.bloodType },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-gray-800 font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ölçümler */}
        {tab === 'measurements' && (
          <div>
            {loadingMeasurements && <p className="text-gray-500">Yükleniyor...</p>}
            {!loadingMeasurements && measurements.length === 0 && (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Ölçüm kaydı yok.</div>
            )}
            <div className="space-y-3">
              {(measurements as any[]).map(m => (
                <div key={m.id} className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{m.type}</p>
                    <p className="text-xs text-gray-400">{dayjs(m.measuredAt).format('DD MMM YYYY HH:mm')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-700">{m.value}</p>
                    <p className="text-xs text-gray-400">{m.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Randevular */}
        {tab === 'appointments' && (
          <div className="space-y-3">
            {patientAppointments.length === 0 && (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Randevu bulunamadı.</div>
            )}
            {patientAppointments.map((a: any) => (
              <div key={a.id} className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {a.appointmentDate} — {a.startTime?.slice(0, 5)}
                  </p>
                  <p className="text-xs text-gray-400">{a.type}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
