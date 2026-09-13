import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { listSchools } from '../api/schools'
import type { School } from '../types/school'

interface ActiveSchoolContextValue {
  schools: School[]
  loading: boolean
  activeSchoolId: number | null
  activeSchool: School | null
  setActiveSchoolId: (id: number | null) => void
  reload: () => Promise<void>
}

const ActiveSchoolContext = createContext<ActiveSchoolContextValue | null>(null)

function storageKey(tenantId: number) {
  return `app.activeSchoolId.${tenantId}`
}

export function ActiveSchoolProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const tenantId = session && !session.is_platform_admin ? session.user.tenant_id : null
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [activeSchoolId, setActiveSchoolIdState] = useState<number | null>(null)

  const reload = async () => {
    if (!tenantId) {
      setSchools([])
      return
    }
    setLoading(true)
    try {
      setSchools(await listSchools())
    } catch {
      setSchools([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  useEffect(() => {
    if (!tenantId || schools.length === 0) return
    let saved: number | null = null
    try {
      const raw = localStorage.getItem(storageKey(tenantId))
      saved = raw ? Number(raw) : null
    } catch {
      saved = null
    }
    setActiveSchoolIdState((prev) => {
      if (prev && schools.some((s) => s.id === prev)) return prev
      if (saved && schools.some((s) => s.id === saved)) return saved
      return schools[0].id
    })
  }, [tenantId, schools])

  const setActiveSchoolId = (id: number | null) => {
    setActiveSchoolIdState(id)
    if (!tenantId) return
    try {
      if (id == null) localStorage.removeItem(storageKey(tenantId))
      else localStorage.setItem(storageKey(tenantId), String(id))
    } catch {
      // localStorage erişilemiyorsa sessizce geç
    }
  }

  const activeSchool = useMemo(
    () => schools.find((s) => s.id === activeSchoolId) || null,
    [schools, activeSchoolId],
  )

  return (
    <ActiveSchoolContext.Provider
      value={{ schools, loading, activeSchoolId, activeSchool, setActiveSchoolId, reload }}
    >
      {children}
    </ActiveSchoolContext.Provider>
  )
}

export function useActiveSchool(): ActiveSchoolContextValue {
  const ctx = useContext(ActiveSchoolContext)
  if (!ctx) throw new Error('useActiveSchool must be used within ActiveSchoolProvider')
  return ctx
}
