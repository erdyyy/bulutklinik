import api from './api'

export const packageApi = {
  getByDoctor: (doctorId: string) =>
    api.get(`/packages/doctor/${doctorId}`).then(r => r.data),

  getByPatient: (patientId: string) =>
    api.get(`/packages/patient/${patientId}`).then(r => r.data),

  create: (data: object) =>
    api.post('/packages', data).then(r => r.data),

  completeSession: (id: string, notes?: string) =>
    api.post(`/packages/${id}/complete-session`, { notes: notes ?? null }).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/packages/${id}`).then(r => r.data),
}
