import api from './api'

export const doctorApi = {
  getAll: () => api.get('/doctors').then(r => r.data),
  getProfile: (doctorId: string) => api.get(`/doctors/${doctorId}`).then(r => r.data),
}
