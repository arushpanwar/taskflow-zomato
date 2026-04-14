export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  project_id: string
  assignee_id: string | null
  created_by: string
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithTasks extends Project {
  tasks: Task[]
}

export interface TaskStats {
  total: number
  by_status: Record<TaskStatus, number>
  by_assignee: Record<string, number>
}

export interface ApiError {
  error: string
  fields?: Record<string, string>
}

export interface AuthResponse {
  token: string
  user: User
}
