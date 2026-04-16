import api from './client';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '../types';

export const projectsApi = {
  getAll: () =>
    api.get<{ data: Project[]; total: number }>('/projects').then((r) => r.data),

  getById: (id: number) =>
    api.get<{ data: Project }>(`/projects/${id}`).then((r) => r.data),

  create: (data: CreateProjectRequest) =>
    api.post<{ message: string; data: Project }>('/projects', data).then((r) => r.data),

  update: (id: number, data: UpdateProjectRequest) =>
    api.put<{ message: string; data: Project }>(`/projects/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/projects/${id}`).then((r) => r.data),
};
