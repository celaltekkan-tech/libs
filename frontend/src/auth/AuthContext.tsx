import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth'
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
  login: (values: LoginFormValues) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
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
    setSession({
      user: payload.user,
      roles: payload.roles,
      permissions: payload.permissions,
      schools: payload.schools,
      is_global_admin: payload.is_global_admin,
      is_platform_admin: payload.is_platform_admin,
    })
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    resetLocalSession()
  }, [resetLocalSession])

  const hasPermission = useCallback(
    (permission: string) => Boolean(session?.is_global_admin || session?.permissions.includes(permission)),
    [session],
  )

  const value = useMemo(
    () => ({ session, ready, login, logout, hasPermission }),
    [session, ready, login, logout, hasPermission],
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
