import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { ApiClientError } from '../api/client'

export function Register() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const clientErrors: Record<string, string> = {}
    if (!form.name.trim()) clientErrors.name = 'Required'
    if (!form.email.trim()) clientErrors.email = 'Required'
    if (form.password.length < 8) clientErrors.password = 'Must be at least 8 characters'
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      signIn(res.token, res.user)
      navigate('/projects')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.body.fields) {
          setErrors(err.body.fields)
        } else {
          setErrors({ _global: err.body.error })
        }
      } else {
        setErrors({ _global: 'Unable to connect. Try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="rounded-xl bg-indigo-600 p-3">
              <CheckSquare className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started with TaskFlow</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors._global && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {errors._global}
              </div>
            )}

            <div>
              <label htmlFor="name" className="label mb-1">Name</label>
              <input
                id="name"
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                autoComplete="name"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="label mb-1">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label mb-1">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
