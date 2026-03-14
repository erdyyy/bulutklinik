import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { medicalApi } from '../../services/medicalApi';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

export function PatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>();
  useAuthStore(s => s.userId);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ chiefComplaint: '', diagnosis: '', treatmentPlan: '', findings: '' });

  const { data: records = [] } = useQuery({
    queryKey: ['medical-records', patientId],
    queryFn: () => medicalApi.getMedicalRecords(patientId!),
  });

  const addRecord = useMutation({
    mutationFn: () => medicalApi.createMedicalRecord('00000000-0000-0000-0000-000000000000', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-records', patientId] });
      setShowForm(false);
      setForm({ chiefComplaint: '', diagnosis: '', treatmentPlan: '', findings: '' });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Hasta Detayı</h1>
      <p className="text-sm text-gray-500 mb-4">Hasta ID: {patientId}</p>

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Muayene Kayıtları</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          + Muayene Notu Ekle
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          {(['chiefComplaint', 'findings', 'diagnosis', 'treatmentPlan'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{field}</label>
              <textarea
                value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm"
                rows={2}
              />
            </div>
          ))}
          <button
            onClick={() => addRecord.mutate()}
            disabled={!form.chiefComplaint}
            className="bg-green-600 text-white px-4 py-1 rounded text-sm disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
      )}

      <div className="space-y-3">
        {records.map((r: any) => (
          <div key={r.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-sm">Dr. {r.doctorName}</span>
              <span className="text-xs text-gray-400">{dayjs(r.createdAt).format('DD.MM.YYYY')}</span>
            </div>
            <p className="text-sm"><strong>Şikayet:</strong> {r.chiefComplaint}</p>
            {r.diagnosis && <p className="text-sm"><strong>Tanı:</strong> {r.diagnosis}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
