import { useCallback, useEffect, useMemo, useState } from 'react'

function readStored<T extends string>(key: string, allowed: readonly T[], defaults: readonly T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return [...defaults]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...defaults]
    const allowedSet = new Set(allowed)
    return allowed.filter((keyName) => parsed.includes(keyName) && allowedSet.has(keyName))
  } catch {
    return [...defaults]
  }
}

function writeStored(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function filterFieldsStorageKey(page: string, userId: number): string {
  return `okul-idare.filter-fields.${page}.${userId}`
}

export function useVisibleFilterFields<T extends string>(
  page: string,
  userId: number | undefined,
  allowed: readonly T[],
  defaults: readonly T[],
) {
  const storageKey = userId != null ? filterFieldsStorageKey(page, userId) : null
  const allowedKey = allowed.join('\0')
  const defaultsKey = defaults.join('\0')
  const [visible, setVisibleState] = useState<T[]>(() =>
    storageKey ? readStored(storageKey, allowed, defaults) : [...defaults],
  )

  useEffect(() => {
    if (!storageKey) {
      setVisibleState([...defaults])
      return
    }
    setVisibleState(readStored(storageKey, allowed, defaults))
    // allowed/defaults kimliği her render değişmesin diye string anahtar
  }, [storageKey, allowedKey, defaultsKey, allowed, defaults])

  const setVisible = useCallback(
    (next: readonly string[]) => {
      const normalized = allowed.filter((key) => next.includes(key))
      setVisibleState(normalized)
      if (storageKey) writeStored(storageKey, normalized)
    },
    [allowed, storageKey],
  )

  const visibleSet = useMemo(() => new Set(visible), [visible])
  const isVisible = useCallback((key: T) => visibleSet.has(key), [visibleSet])

  return { visible, setVisible, isVisible }
}
