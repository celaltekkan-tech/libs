import { useEffect, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 500

/** Yazılan değeri `delay` ms sonra günceller. Kutu boşalınca hemen yansır. */
export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setDebounced(value)
      return
    }
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}
