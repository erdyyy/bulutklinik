import api from './api'

export const getSchedules = (doctorId: string) =>
  api.get(`/doctors/${doctorId}/schedules`).then((r) => r.data)

export const upsertSchedule = (doctorId: string, data: object) =>
  api.put(`/doctors/${doctorId}/schedules`, data).then((r) => r.data)

export const getLeaves = (doctorId: string) =>
  api.get(`/doctors/${doctorId}/schedules/leaves`).then((r) => r.data)

export const addLeave = (doctorId: string, data: object) =>
  api.post(`/doctors/${doctorId}/schedules/leaves`, data).then((r) => r.data)
