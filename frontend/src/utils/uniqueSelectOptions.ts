export function uniqueSelectOptions(values: (string | number | null | undefined)[]) {
  const set = new Set<string>()
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (text) set.add(text)
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    .map((value) => ({ value, label: value }))
}

export function trSelectFilter(input: string, option?: { label?: string }) {
  return (option?.label || '').toLocaleLowerCase('tr-TR').includes(input.trim().toLocaleLowerCase('tr-TR'))
}
