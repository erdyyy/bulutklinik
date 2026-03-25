import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { medicalApi } from '../../services/medicalApi'
import PatientLayout from '../../components/patient/PatientLayout'
import dayjs from 'dayjs'

const MEASUREMENT_TYPES = ['BloodPressure', 'HeartRate', 'BloodSugar', 'Weight', 'Height', 'Temperature', 'OxygenSaturation']

const TYPE_LABELS: Record<string, string> = {
  BloodPressure: 'Tansiyon',
  HeartRate: 'Nabız',
  BloodSugar: 'Kan Şekeri',
  Weight: 'Kilo',
  Height: 'Boy',
  Temperature: 'Ateş',
  OxygenSaturation: 'SpO2',
}

const TYPE_ICONS: Record<string, string> = {
  BloodPressure: '🩺', HeartRate: '❤️', BloodSugar: '🩸',
  Weight: '⚖️', Height: '📏', Temperature: '🌡️', OxygenSaturation: '💨',
}

export default function MyMeasurementsPage() {
  const { userId } = useAuthStore()
  const qc = useQueryClient()
  const [selectedType, setSelectedType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'BloodPressure', value: '', unit: '' })

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['my-measurements', userId, selectedType],
    queryFn: () => medicalApi.getMeasurements(userId!, selectedType || undefined),
    enabled: !!userId,
  })

  const addMutation = useMutation({
    mutationFn: (data: object) => medicalApi.createMeasurement(userId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-measurements'] })
      setShowForm(false)
      setForm({ type: 'BloodPressure', value: '', unit: '' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.value || !form.unit) return
    addMutation.mutate({ type: form.type, value: form.value, unit: form.unit })
  }

  const addBtn = (
    <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
      + Ölçüm Ekle
    </button>
  )

  return (
    <PatientLayout title="Ölçümlerim" action={addBtn}>
      <div className="max-w-2xl">
        <div className="mb-6" />

        {/* Ölçüm ekleme formu */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Yeni Ölçüm</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tür</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {MEASUREMENT_TYPES.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Değer</label>
                <input
                  type="text"
                  placeholder="ör. 120/80"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Birim</label>
                <input
                  type="text"
                  placeholder="ör. mmHg, bpm, kg"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {addMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {/* Filtre */}
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setSelectedType('')}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              selectedType === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Tümü
          </button>
          {MEASUREMENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-gray-500">Yükleniyor...</p>}
        {!isLoading && measurements.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            Henüz ölçüm bulunmuyor.
          </div>
        )}

        <div className="space-y-3">
          {measurements.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[m.type] ?? '📊'}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{TYPE_LABELS[m.type] ?? m.type}</p>
                  <p className="text-xs text-gray-500">{dayjs(m.measuredAt).format('DD MMM YYYY HH:mm')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-blue-700">{m.value}</p>
                <p className="text-xs text-gray-400">{m.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PatientLayout>
  )
}
