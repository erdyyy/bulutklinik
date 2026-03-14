import { api } from './api';

export const invoiceApi = {
  getInvoices: (patientId?: string) =>
    api.get('/api/invoices', { params: { patientId } }).then(r => r.data),
  getInvoice: (id: string) =>
    api.get(`/api/invoices/${id}`).then(r => r.data),
  createInvoice: (data: object) =>
    api.post('/api/invoices', data).then(r => r.data),
  updateStatus: (id: string, data: object) =>
    api.patch(`/api/invoices/${id}/status`, data).then(r => r.data),
  addPayment: (id: string, data: object) =>
    api.post(`/api/invoices/${id}/payment`, data).then(r => r.data),
  getServices: () =>
    api.get('/api/services').then(r => r.data),
};
