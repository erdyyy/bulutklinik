import api from './api'

export const medicalApi = {
  getHistory: (patientId: string) =>
    api.get(`/patients/${patientId}/history`).then(r => r.data),

  upsertHistory: (patientId: string, data: object) =>
    api.put(`/patients/${patientId}/history`, data).then(r => r.data),

  createRecord: (appointmentId: string, data: object) =>
    api.post(`/appointments/${appointmentId}/medical-record`, data).then(r => r.data),

  getRecords: (patientId: string) =>
    api.get(`/patients/${patientId}/medical-records`).then(r => r.data),

  createMeasurement: (patientId: string, data: object) =>
    api.post(`/patients/${patientId}/measurements`, data).then(r => r.data),

  getMeasurements: (patientId: string, type?: string) =>
    api.get(`/patients/${patientId}/measurements`, { params: { type } }).then(r => r.data),
}
