import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Props {
  children: React.ReactNode
  role?: string
}

export default function ProtectedRoute({ children, role }: Props) {
  const { token, role: userRole } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />
  if (role && userRole !== role) return <Navigate to="/" replace />

  return <>{children}</>
}
