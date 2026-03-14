import api from './api'

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then((r) => r.data)

export const register = (email: string, password: string, phoneNumber: string, role: string) =>
  api.post('/auth/register', { email, password, phoneNumber, role }).then((r) => r.data)
