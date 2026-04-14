import { api } from './client'
import type { Project, ProjectWithTasks, TaskStats } from '../types'

export const projectsApi = {
  list: () => api.get<{ projects: Project[] }>('/projects'),

  get: (id: string) => api.get<ProjectWithTasks>(`/projects/${id}`),

  create: (data: { name: string; description?: string }) =>
    api.post<Project>('/projects', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Project>(`/projects/${id}`, data),

  delete: (id: string) => api.delete(`/projects/${id}`),

  stats: (id: string) => api.get<TaskStats>(`/projects/${id}/stats`),
}
