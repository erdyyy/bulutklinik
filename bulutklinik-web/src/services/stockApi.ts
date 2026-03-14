import api from './api'

export const stockApi = {
  getAll: () => api.get('/stock').then(r => r.data),
  create: (data: object) => api.post('/stock', data).then(r => r.data),
  addMovement: (id: string, data: object) =>
    api.post(`/stock/${id}/movement`, data).then(r => r.data),
  getLow: () => api.get('/stock/low').then(r => r.data),
}
