import { api } from './api';

export const appointmentApi = {
  getSlots: (doctorId: string, date: string) =>
    api.get(`/api/appointments/slots`, { params: { doctorId, date } }).then(r => r.data),
  create: (data: object) =>
    api.post('/api/appointments', data).then(r => r.data),
  getMyAppointments: () =>
    api.get('/api/appointments/my').then(r => r.data),
  getDoctorAppointments: (doctorId: string, date?: string) =>
    api.get(`/api/appointments/doctor/${doctorId}`, { params: { date } }).then(r => r.data),
  updateStatus: (id: string, data: object) =>
    api.patch(`/api/appointments/${id}/status`, data).then(r => r.data),
};
