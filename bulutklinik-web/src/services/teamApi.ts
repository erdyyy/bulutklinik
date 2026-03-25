import api from './api'

export const teamApi = {
  getByDoctor: (doctorId: string) =>
    api.get(`/team/${doctorId}`).then(r => r.data),

  create: (data: object) =>
    api.post('/team', data).then(r => r.data),

  update: (id: string, data: object) =>
    api.patch(`/team/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/team/${id}`).then(r => r.data),
}
