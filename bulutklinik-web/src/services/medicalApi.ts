import { api } from './api';

export const medicalApi = {
  getHistory: (patientId: string) =>
    api.get(`/api/patients/${patientId}/history`).then(r => r.data),
  upsertHistory: (patientId: string, data: object) =>
    api.put(`/api/patients/${patientId}/history`, data).then(r => r.data),
  getMedicalRecords: (patientId: string) =>
    api.get(`/api/patients/${patientId}/medical-records`).then(r => r.data),
  createMedicalRecord: (appointmentId: string, data: object) =>
    api.post(`/api/appointments/${appointmentId}/medical-record`, data).then(r => r.data),
  getMeasurements: (patientId: string, type?: string) =>
    api.get(`/api/patients/${patientId}/measurements`, { params: { type } }).then(r => r.data),
  addMeasurement: (patientId: string, data: object) =>
    api.post(`/api/patients/${patientId}/measurements`, data).then(r => r.data),
};
