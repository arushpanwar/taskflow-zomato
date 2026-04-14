import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { projectsApi } from '../api/projects'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { ApiClientError } from '../api/client'
import type { Project } from '../types'

export function Projects() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createError, setCreateError] = useState('')

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      setCreateError('')
    },
    onError: (err) => {
      setCreateError(err instanceof ApiClientError ? err.body.error : 'Something went wrong')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          Failed to load projects: {error.message}
        </div>
      </div>
    )
  }

  const projects = data?.projects ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6 p-5">
          <h2 className="mb-4 text-sm font-semibold">New Project</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label mb-1">Name *</label>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                autoFocus
              />
            </div>
            <div>
              <label className="label mb-1">Description</label>
              <input
                className="input"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowCreate(false)
                  setNewName('')
                  setNewDesc('')
                  setCreateError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start organizing tasks."
          action={
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isOwner={project.owner_id === user?.id}
              onDelete={() => {
                if (confirm(`Delete "${project.name}"? This will also delete all its tasks.`)) {
                  deleteMutation.mutate(project.id)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  isOwner,
  onDelete,
}: {
  project: Project
  isOwner: boolean
  onDelete: () => void
}) {
  return (
    <div className="card group flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/projects/${project.id}`}
          className="flex-1 text-sm font-semibold hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {project.name}
        </Link>
        {isOwner && (
          <button
            onClick={onDelete}
            className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            aria-label="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {project.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {project.description}
        </p>
      )}
      <div className="mt-auto pt-4">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(project.created_at).toLocaleDateString()}
          {isOwner && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">owner</span>}
        </p>
      </div>
    </div>
  )
}
