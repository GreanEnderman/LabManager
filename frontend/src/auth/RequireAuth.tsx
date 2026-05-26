import { Navigate, useLocation } from 'react-router-dom'
import { readHttpAuthToken } from '../runtime/httpAuthSession'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  if (!readHttpAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
