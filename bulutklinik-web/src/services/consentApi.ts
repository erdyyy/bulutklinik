import api from './api'

export const consentApi = {
  getByDoctor: (doctorId: string) =>
    api.get(`/consents/doctor/${doctorId}`).then(r => r.data),

  getByPatient: (patientId: string) =>
    api.get(`/consents/patient/${patientId}`).then(r => r.data),

  create: (data: object) =>
    api.post('/consents', data).then(r => r.data),
}
