import api from './client';
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskHistoryEntry, TaskTimeLog, TaskTimeLogsResponse, TaskAttachment } from '../types';

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

  clockIn: (id: number, clockIn?: string) =>
    api.post<{ message: string; data: TaskTimeLog }>(`/tasks/${id}/clock-in`, clockIn ? { clock_in: clockIn } : {}).then((r) => r.data),

  clockOut: (id: number, clockOut?: string) =>
    api.post<{ message: string; data: TaskTimeLog }>(`/tasks/${id}/clock-out`, clockOut ? { clock_out: clockOut } : {}).then((r) => r.data),

  getTimeLogs: (id: number) =>
    api.get<{ data: TaskTimeLogsResponse }>(`/tasks/${id}/time-logs`).then((r) => r.data),

  createManualTimeLog: (id: number, clockIn: string, clockOut: string) =>
    api.post<{ message: string; data: TaskTimeLog }>(`/tasks/${id}/time-logs`, { clock_in: clockIn, clock_out: clockOut }).then((r) => r.data),

  deleteTimeLog: (taskId: number, logId: number) =>
    api.delete<{ message: string }>(`/tasks/${taskId}/time-logs/${logId}`).then((r) => r.data),

  getAttachments: (id: number) =>
    api.get<{ data: TaskAttachment[] }>(`/tasks/${id}/attachments`).then((r) => r.data),

  createAttachment: (id: number, filename: string, mimeType: string, data: string) =>
    api.post<{ data: TaskAttachment }>(`/tasks/${id}/attachments`, { filename, mime_type: mimeType, data }).then((r) => r.data),

  deleteAttachment: (taskId: number, attachmentId: number) =>
    api.delete<{ message: string }>(`/tasks/${taskId}/attachments/${attachmentId}`).then((r) => r.data),

  createSubtask: (projectId: number, parentTaskId: number, title: string) =>
    api.post<{ message: string; data: Task }>(`/projects/${projectId}/tasks`, {
      title,
      status: 'backlog',
      priority: 'medium',
      parent_task_id: parentTaskId,
    }).then((r) => r.data),

  getMyTimeLogs: (from: string, to: string) =>
    api.get<{ data: TaskTimeLog[] }>(`/me/time-logs?from=${from}&to=${to}`).then((r) => r.data),

  getAllTimeLogs: (from: string, to: string) =>
    api.get<{ data: TaskTimeLog[] }>(`/time-logs?from=${from}&to=${to}`).then((r) => r.data),

  getMyActiveLog: () =>
    api.get<{ data: TaskTimeLog | null }>('/me/active-log').then((r) => r.data),

  getActiveLogsByProject: (projectId: number) =>
    api.get<{ data: TaskTimeLog[] }>(`/projects/${projectId}/active-logs`).then((r) => r.data),
};
