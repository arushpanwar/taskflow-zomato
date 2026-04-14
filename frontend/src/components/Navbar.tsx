import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'

export function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  function handleLogout() {
    signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/projects"
          className="flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400"
        >
          <CheckSquare className="h-5 w-5" />
          <span>TaskFlow</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user && (
            <>
              <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 sm:block">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
