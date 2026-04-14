import api from './client';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../types';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    api.post<{ message: string; user: User }>('/auth/register', data).then((r) => r.data),

  me: () =>
    api.get<{ user_id: number; email: string; role: string }>('/auth/me').then((r) => r.data),
};
