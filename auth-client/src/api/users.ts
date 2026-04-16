import api from './client';
import type { User, UpdateUserRequest } from '../types';

export const usersApi = {
  getAll: () =>
    api.get<{ data: User[]; total: number }>('/users').then((r) => r.data),

  getById: (id: number) =>
    api.get<{ data: User }>(`/users/${id}`).then((r) => r.data),

  update: (id: number, data: UpdateUserRequest) =>
    api.put<{ message: string; data: User }>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/users/${id}`).then((r) => r.data),
};
