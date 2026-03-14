import { api } from './api';

export const stockApi = {
  getStock: () => api.get('/api/stock').then(r => r.data),
  getLowStock: () => api.get('/api/stock/low').then(r => r.data),
  createItem: (data: object) => api.post('/api/stock', data).then(r => r.data),
  addMovement: (id: string, data: object) =>
    api.post(`/api/stock/${id}/movement`, data).then(r => r.data),
  getDashboard: () => api.get('/api/dashboard').then(r => r.data),
};
