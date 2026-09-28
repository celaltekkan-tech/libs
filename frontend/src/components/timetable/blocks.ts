/** Varsayılan: 2'li bloklar, kalan 1 saat (5 → 2+2+1). */
export function defaultBlockPattern(hours: number): string {
  if (hours <= 0) return ''
  const parts = Array.from({ length: Math.floor(hours / 2) }, () => 2)
  if (hours % 2) parts.push(1)
  return parts.join('+')
}

function normalizePattern(pattern: string): string | null {
  const parts = pattern
    .split(/[+,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0)
  if (!parts.length) return null
  return parts.join('+')
}

/** 1–4 saatlik parçalardan, toplamı verilen saate eşit blok düzenleri. */
export function blockPatternChoices(hours: number, current?: string | null): { value: string; label: string }[] {
  if (hours < 1) return []
  const maxPart = Math.min(4, hours)
  const found: string[] = []
  const walk = (remain: number, max: number, acc: number[]) => {
    if (remain === 0) {
      found.push(acc.join('+'))
      return
    }
    const upper = Math.min(max, remain, maxPart)
    for (let part = upper; part >= 1; part -= 1) {
      acc.push(part)
      walk(remain - part, part, acc)
      acc.pop()
    }
  }
  walk(hours, maxPart, [])

  const automatic = defaultBlockPattern(hours)
  const options = found.map((value) => ({
    value,
    label: value === automatic ? `${value} (otomatik)` : value,
  }))
  const known = new Set(options.map((item) => item.value))
  const extra = current ? normalizePattern(current) : null
  if (extra && extra.split('+').reduce((sum, part) => sum + Number(part), 0) === hours && !known.has(extra)) {
    options.unshift({ value: extra, label: extra })
  }
  options.sort((a, b) => {
    if (a.value === automatic) return -1
    if (b.value === automatic) return 1
    return a.value.length - b.value.length || a.value.localeCompare(b.value, 'tr')
  })
  return options
}
