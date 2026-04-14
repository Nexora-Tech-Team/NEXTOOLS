export type Role = 'admin' | 'user';
export type TaskStatus = string;
export type TaskPriority = 'low' | 'medium' | 'high';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  user?: User;
  role: 'owner' | 'member';
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  owner?: User;
  task_count: number;
  member_count: number;
  members?: ProjectMember[];
  created_at: string;
  updated_at: string;
}

export interface TaskHistoryEntry {
  id: number;
  task_id: number;
  action: 'created' | 'updated';
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by?: User;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  project_id: number;
  assignee_id?: number;
  assignee?: User;
  creator_id: number;
  creator?: User;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

// Auth
export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; role?: Role; }
export interface LoginResponse { token: string; user: User; }
export interface UpdateUserRequest { name?: string; email?: string; password?: string; role?: Role; is_active?: boolean; }

// Project
export interface CreateProjectRequest { name: string; description?: string; }
export interface UpdateProjectRequest { name?: string; description?: string; }

// Task
export interface CreateTaskRequest {
  title: string;
  description?: string;
  assignee_id?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string; // "YYYY-MM-DD" or ""
}
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assignee_id?: number;
  clear_assignee?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string; // "YYYY-MM-DD" or "" to clear
}
