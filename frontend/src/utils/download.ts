export type ExportFormat = 'xlsx' | 'csv' | 'pdf'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(base: string, format: ExportFormat): string {
  return `${base}.${format}`
}
