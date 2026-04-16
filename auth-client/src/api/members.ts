import api from './client';
import type { ProjectMember } from '../types';

export const membersApi = {
  getByProject: (projectId: number) =>
    api.get<{ data: ProjectMember[]; total: number }>(`/projects/${projectId}/members`).then((r) => r.data),

  add: (projectId: number, userId: number) =>
    api.post<{ message: string }>(`/projects/${projectId}/members`, { user_id: userId }).then((r) => r.data),

  remove: (projectId: number, userId: number) =>
    api.delete<{ message: string }>(`/projects/${projectId}/members/${userId}`).then((r) => r.data),
};
