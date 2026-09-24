import { Navigate, Outlet } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'

/** Sends already-authenticated users straight to the dashboard instead of showing them login/register again. */
export function PublicOnlyRoute() {
  const initializing = useAuthStore((s) => s.initializing)
  const user = useAuthStore((s) => s.user)

  if (initializing) return <FullPageSpinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
