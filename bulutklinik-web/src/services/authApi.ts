import { api } from './api';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { email: string; password: string; phoneNumber: string; role: string; }
export interface AuthResponse { accessToken: string; role: string; userId: string; expiresAt: string; }

export const authApi = {
  login:    (data: LoginRequest)    => api.post<AuthResponse>('/api/auth/login', data).then(r => r.data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/api/auth/register', data).then(r => r.data),
};
