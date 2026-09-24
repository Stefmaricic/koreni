import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const initializing = useAuthStore((s) => s.initializing)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (initializing) return <FullPageSpinner />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
