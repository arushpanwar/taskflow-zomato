import { api } from './client'
import type { Task, TaskPriority, TaskStatus } from '../types'

export interface CreateTaskData {
  title: string
  description?: string
  priority?: TaskPriority
  assignee_id?: string | null
  due_date?: string | null
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string | null
  due_date?: string | null
}

export const tasksApi = {
  list: (projectId: string, filters?: { status?: string; assignee?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.assignee) params.set('assignee', filters.assignee)
    const query = params.toString() ? `?${params}` : ''
    return api.get<{ tasks: Task[] }>(`/projects/${projectId}/tasks${query}`)
  },

  create: (projectId: string, data: CreateTaskData) =>
    api.post<Task>(`/projects/${projectId}/tasks`, data),

  update: (id: string, data: UpdateTaskData) => api.patch<Task>(`/tasks/${id}`, data),

  delete: (id: string) => api.delete(`/tasks/${id}`),
}
