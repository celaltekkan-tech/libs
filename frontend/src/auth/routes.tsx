import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { session, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="app-boot">
        <Spin size="large" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function PlatformAdminRoute() {
  const { session, ready } = useAuth()

  if (!ready) {
    return (
      <div className="app-boot">
        <Spin size="large" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!session.is_platform_admin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { session, ready } = useAuth()

  if (!ready) {
    return (
      <div className="app-boot">
        <Spin size="large" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
