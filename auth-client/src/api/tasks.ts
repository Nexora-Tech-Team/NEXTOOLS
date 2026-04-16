import api from './client';
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskHistoryEntry } from '../types';

export const tasksApi = {
  getByProject: (projectId: number) =>
    api.get<{ data: Task[]; total: number }>(`/projects/${projectId}/tasks`).then((r) => r.data),

  create: (projectId: number, data: CreateTaskRequest) =>
    api.post<{ message: string; data: Task }>(`/projects/${projectId}/tasks`, data).then((r) => r.data),

  update: (id: number, data: UpdateTaskRequest) =>
    api.put<{ message: string; data: Task }>(`/tasks/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/tasks/${id}`).then((r) => r.data),

  getHistory: (id: number) =>
    api.get<{ data: TaskHistoryEntry[]; total: number }>(`/tasks/${id}/history`).then((r) => r.data),
};
