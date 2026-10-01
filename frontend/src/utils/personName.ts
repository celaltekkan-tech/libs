export function upperPersonName(value: string) {
  return String(value ?? '').toLocaleUpperCase('tr-TR')
}
