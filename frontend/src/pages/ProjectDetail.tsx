import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react'
import { projectsApi } from '../api/projects'
import { tasksApi } from '../api/tasks'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { TaskModal } from '../components/TaskModal'
import type { Task, TaskStatus } from '../types'
import { clsx } from 'clsx'

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; color: string; bg: string }
> = {
  todo: {
    label: 'To Do',
    icon: Circle,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950',
  },
  done: {
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950',
  },
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done']

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  // Optimistic status update
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      tasksApi.update(taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: ['project', id] })
      const prev = qc.getQueryData(['project', id])
      qc.setQueryData(['project', id], (old: typeof data) => {
        if (!old) return old
        return {
          ...old,
          tasks: old.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        }
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['project', id], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error?.message ?? 'Project not found'}
        </div>
      </div>
    )
  }

  const isOwner = data.owner_id === user?.id

  const filteredTasks = statusFilter
    ? data.tasks.filter((t) => t.status === statusFilter)
    : data.tasks

  const grouped = STATUSES.reduce<Record<TaskStatus, Task[]>>(
    (acc, s) => ({ ...acc, [s]: filteredTasks.filter((t) => t.status === s) }),
    { todo: [], in_progress: [], done: [] },
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{data.name}</h1>
            {data.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{data.description}</p>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingTask(null)
              setTaskModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={clsx(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            !statusFilter
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
          )}
        >
          All ({data.tasks.length})
        </button>
        {STATUSES.map((s) => {
          const count = data.tasks.filter((t) => t.status === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              )}
            >
              {STATUS_CONFIG[s].label} ({count})
            </button>
          )
        })}
      </div>

      {/* Task board */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks"
          description={statusFilter ? 'No tasks with this status.' : 'Add your first task to get started.'}
          action={
            !statusFilter ? (
              <button
                className="btn-primary"
                onClick={() => {
                  setEditingTask(null)
                  setTaskModalOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const tasks = grouped[status]
            return (
              <div key={status}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className={clsx('h-4 w-4', cfg.color)} />
                  <h2 className="text-sm font-semibold">{cfg.label}</h2>
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {tasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOwner={isOwner}
                      onEdit={() => {
                        setEditingTask(task)
                        setTaskModalOpen(true)
                      }}
                      onDelete={() => {
                        if (confirm(`Delete "${task.title}"?`)) {
                          deleteMutation.mutate(task.id)
                        }
                      }}
                      onStatusChange={(newStatus) =>
                        statusMutation.mutate({ taskId: task.id, status: newStatus })
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TaskModal
        projectId={id!}
        task={editingTask}
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false)
          setEditingTask(null)
        }}
      />
    </div>
  )
}

function TaskCard({
  task,
  isOwner,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task
  isOwner: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
}) {
  const nextStatus: Record<TaskStatus, TaskStatus> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: 'todo',
  }

  return (
    <div className="card group p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onStatusChange(nextStatus[task.status])}
          className="mt-0.5 shrink-0 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          title="Advance status"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : task.status === 'in_progress' ? (
            <Clock className="h-4 w-4 text-blue-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        <p
          className={clsx(
            'flex-1 text-sm font-medium leading-snug',
            task.status === 'done' && 'text-gray-400 line-through dark:text-gray-500',
          )}
        >
          {task.title}
        </p>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {(isOwner) && (
            <button
              onClick={onDelete}
              className="rounded p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="mt-2 line-clamp-2 pl-6 text-xs text-gray-500 dark:text-gray-400">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
        <span className={clsx('rounded px-1.5 py-0.5 text-xs font-medium capitalize', PRIORITY_BADGE[task.priority])}>
          {task.priority}
        </span>

        {task.assignee_id && (
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <User className="h-3 w-3" />
            <span className="font-mono">{task.assignee_id.slice(0, 8)}</span>
          </span>
        )}

        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Calendar className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
