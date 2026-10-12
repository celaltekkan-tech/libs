/** manifest.json içindeki anahtardan üretilen sabit eklenti kimliği. */
export const EOKUL_EXTENSION_ID = 'pgahffkffoibfbfdfblffjdfcjoabhkf'

/** Sürüm bilgisi yoksa (1.1.0 ve öncesi) bu kabul edilir. */
export const EOKUL_EXTENSION_LEGACY_VERSION = '1.1.0'

export function compareExtensionVersions(left?: string | null, right?: string | null): number {
  const a = String(left || '')
    .split('.')
    .map((part) => Number(part) || 0)
  const b = String(right || '')
    .split('.')
    .map((part) => Number(part) || 0)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0)
    if (delta) return delta < 0 ? -1 : 1
  }
  return 0
}

export function isExtensionOutdated(installed: string | undefined, latest: string | undefined): boolean {
  if (!latest) return false
  return compareExtensionVersions(installed || EOKUL_EXTENSION_LEGACY_VERSION, latest) < 0
}
