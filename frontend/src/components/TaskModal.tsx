import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { tasksApi } from '../api/tasks'
import type { Task, TaskPriority, TaskStatus } from '../types'
import { ApiClientError } from '../api/client'

interface Props {
  projectId: string
  task?: Task | null
  isOpen: boolean
  onClose: () => void
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function TaskModal({ projectId, task, isOpen, onClose }: Props) {
  const qc = useQueryClient()
  const isEditing = !!task

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
    assignee_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.slice(0, 10) : '',
        assignee_id: task.assignee_id ?? '',
      })
    } else {
      setForm({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        due_date: '',
        assignee_id: '',
      })
    }
    setErrors({})
  }, [task, isOpen])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId] })
  }

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.create>[1]) =>
      tasksApi.create(projectId, data),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.body.fields) {
        setErrors(err.body.fields)
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) =>
      tasksApi.update(task!.id, data),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.body.fields) {
        setErrors(err.body.fields)
      }
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assignee_id: form.assignee_id.trim() || null,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Transition show={isOpen}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Overlay */}
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </TransitionChild>

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="card w-full max-w-md p-6">
                <div className="mb-5 flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold">
                    {isEditing ? 'Edit Task' : 'New Task'}
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label mb-1">Title *</label>
                    <input
                      className="input"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Task title"
                    />
                    {errors.title && (
                      <p className="mt-1 text-xs text-red-500">{errors.title}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1">Description</label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {isEditing && (
                      <div>
                        <label className="label mb-1">Status</label>
                        <select
                          className="input"
                          value={form.status}
                          onChange={(e) =>
                            setForm({ ...form, status: e.target.value as TaskStatus })
                          }
                        >
                          {statusOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="label mb-1">Priority</label>
                      <select
                        className="input"
                        value={form.priority}
                        onChange={(e) =>
                          setForm({ ...form, priority: e.target.value as TaskPriority })
                        }
                      >
                        {priorityOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label mb-1">Due Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label mb-1">Assignee ID</label>
                    <input
                      className="input font-mono text-xs"
                      value={form.assignee_id}
                      onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                      placeholder="UUID of user to assign (optional)"
                    />
                  </div>

                  {(createMutation.isError || updateMutation.isError) &&
                    !Object.keys(errors).length && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                        {mutationError?.message ?? 'Something went wrong'}
                      </p>
                    )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isPending}>
                      {isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Task'}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
