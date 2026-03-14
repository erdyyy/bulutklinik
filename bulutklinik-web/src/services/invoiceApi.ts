import api from './api'

export const invoiceApi = {
  getServices: () => api.get('/services').then(r => r.data),
  createService: (data: object) => api.post('/services', data).then(r => r.data),
  createInvoice: (data: object) => api.post('/invoices', data).then(r => r.data),
  getInvoice: (id: string) => api.get(`/invoices/${id}`).then(r => r.data),
  getInvoices: (patientId?: string) =>
    api.get('/invoices', { params: patientId ? { patientId } : {} }).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/invoices/${id}/status`, { status }).then(r => r.data),
  addPayment: (id: string, data: object) =>
    api.post(`/invoices/${id}/payment`, data).then(r => r.data),
  getRevenue: (from: string, to: string) =>
    api.get('/reports/revenue', { params: { from, to } }).then(r => r.data),
}
