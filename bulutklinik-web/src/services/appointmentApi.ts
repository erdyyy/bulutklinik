import api from './api'

export const getSlots = (doctorId: string, date: string) =>
  api.get('/appointments/slots', { params: { doctorId, date } }).then((r) => r.data)

export const createAppointment = (data: {
  doctorId: string
  appointmentDate: string
  startTime: string
  type: string
  notes?: string
}) => api.post('/appointments', data).then((r) => r.data)

export const getMyAppointments = () =>
  api.get('/appointments/my').then((r) => r.data)

export const getDoctorAppointments = (doctorId: string) =>
  api.get(`/appointments/doctor/${doctorId}`).then((r) => r.data)

export const updateStatus = (id: string, status: string) =>
  api.patch(`/appointments/${id}/status`, { status }).then((r) => r.data)
