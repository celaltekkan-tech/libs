import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './AuthContext'
import { LicenseExpiredPage } from '../pages/LicenseExpiredPage'

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

// Lisansı sona ermiş (veya hiç tanımlanmamış) tenant kullanıcılarını uygulamanın
// geri kalanına erişimden engeller; sadece uyarı ekranı ve çıkış yapabilirler.
// Platform admin (license_status: 'exempt') bu kontrolden etkilenmez.
export function LicenseGuard() {
  const { session, ready } = useAuth()

  if (!ready) {
    return (
      <div className="app-boot">
        <Spin size="large" />
      </div>
    )
  }

  if (session && session.license_status === 'expired') {
    return <LicenseExpiredPage />
  }

  return <Outlet />
}

// Tenant'ın planında yer almayan bir modüle (schools/teachers/users) doğrudan
// URL ile erişilmeye çalışılırsa ana sayfaya yönlendirir. Backend zaten aynı
// kontrolü moduleGuard middleware'i ile uygular; bu sadece frontend UX'i içindir.
export function ModuleRoute({ module }: { module: string }) {
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

  if (!session.is_platform_admin && !session.modules.includes(module)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/** Belirli okul/global rollere sahip kullanıcılar için rota koruması. */
export function RoleRoute({ roles }: { roles: string[] }) {
  const { ready, hasRole } = useAuth()

  if (!ready) {
    return (
      <div className="app-boot">
        <Spin size="large" />
      </div>
    )
  }

  const allowed = roles.some((role) => hasRole(role))
  if (!allowed) {
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
