import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, user: User) => void
  signOut: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadInitialState(): AuthState {
  try {
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    if (token && raw) {
      return { token, user: JSON.parse(raw) as User }
    }
  } catch {
    // corrupt storage — ignore
  }
  return { token: null, user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState)

  const signIn = useCallback((token: string, user: User) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setState({ token, user })
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setState({ token: null, user: null })
  }, [])

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signOut, isAuthenticated: !!state.token }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
