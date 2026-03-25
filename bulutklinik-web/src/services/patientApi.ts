import api from './api'

export const patientApi = {
  getAll: () => api.get('/appointments/doctor-patients').then(r => r.data),
  getDoctorAppointments: (doctorId: string) =>
    api.get(`/appointments/doctor/${doctorId}`).then(r => r.data),
  getDocuments: (patientId: string) =>
    api.get(`/patients/${patientId}/documents`).then(r => r.data),
  uploadDocument: (patientId: string, data: object) =>
    api.post(`/patients/${patientId}/documents`, data).then(r => r.data),
  dashboard: () => api.get('/dashboard').then(r => r.data),

  // Notifications
  sendNotification: (data: object) =>
    api.post('/notifications/send', data).then(r => r.data),
  getNotifications: (patientId: string) =>
    api.get(`/notifications?patientId=${patientId}`).then(r => r.data),

  // Profile
  getProfile: () => api.get('/me').then(r => r.data),
  updateProfile: (data: object) => api.put('/me', data).then(r => r.data),
}
