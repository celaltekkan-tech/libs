import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
} from '../api/auth'
import {
  clearSession,
  getStoredExpiry,
  getStoredToken,
  isTokenExpired,
  setUnauthorizedHandler,
} from '../api/client'
import type { LoginFormValues, SessionPayload } from '../types/auth'

interface AuthContextValue {
  session: SessionPayload | null
  ready: boolean
  login: (values: LoginFormValues) => Promise<SessionPayload>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  setSessionPayload: (payload: SessionPayload) => void
  hasPermission: (permission: string) => boolean
  hasModule: (module: string) => boolean
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [ready, setReady] = useState(false)

  const resetLocalSession = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(resetLocalSession)
    return () => setUnauthorizedHandler(null)
  }, [resetLocalSession])

  useEffect(() => {
    const token = getStoredToken()
    if (!token || isTokenExpired(getStoredExpiry())) {
      clearSession()
      setReady(true)
      return
    }

    fetchMe()
      .then((payload) => setSession(payload))
      .catch(() => {
        clearSession()
        setSession(null)
      })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (values: LoginFormValues) => {
    const payload = await loginRequest(values)
    const sessionPayload: SessionPayload = {
      user: payload.user,
      roles: payload.roles,
      permissions: payload.permissions,
      schools: payload.schools,
      is_global_admin: payload.is_global_admin,
      is_platform_admin: payload.is_platform_admin,
      license_status: payload.license_status,
      license: payload.license,
      modules: payload.modules,
    }
    setSession(sessionPayload)
    return sessionPayload
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    resetLocalSession()
  }, [resetLocalSession])

  const refreshSession = useCallback(async () => {
    const payload = await fetchMe()
    setSession(payload)
  }, [])

  const setSessionPayload = useCallback((payload: SessionPayload) => {
    setSession(payload)
  }, [])

  const hasPermission = useCallback(
    (permission: string) => Boolean(session?.is_global_admin || session?.permissions.includes(permission)),
    [session],
  )

  const hasModule = useCallback(
    (module: string) => Boolean(session?.is_platform_admin || session?.modules.includes(module)),
    [session],
  )

  const hasRole = useCallback(
    (role: string) => {
      if (!session) return false
      if (session.is_global_admin || session.is_platform_admin) return true
      if (session.user.role === role) return true
      return session.roles.includes(role)
    },
    [session],
  )

  const value = useMemo(
    () => ({
      session,
      ready,
      login,
      logout,
      refreshSession,
      setSessionPayload,
      hasPermission,
      hasModule,
      hasRole,
    }),
    [session, ready, login, logout, refreshSession, setSessionPayload, hasPermission, hasModule, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir')
  }
  return context
}
