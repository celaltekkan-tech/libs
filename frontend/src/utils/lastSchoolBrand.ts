const STORAGE_KEY = 'okul-idare.last-school-brand'
const MAX_DATA_URL_CHARS = 400_000

export interface LastSchoolBrand {
  schoolId: number
  name: string
  dataUrl: string
}

export function readLastSchoolBrand(): LastSchoolBrand | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LastSchoolBrand>
    if (
      typeof parsed.schoolId !== 'number' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.dataUrl !== 'string' ||
      !parsed.dataUrl.startsWith('data:image/')
    ) {
      return null
    }
    return { schoolId: parsed.schoolId, name: parsed.name, dataUrl: parsed.dataUrl }
  } catch {
    return null
  }
}

export function writeLastSchoolBrand(brand: LastSchoolBrand): void {
  if (!brand.dataUrl.startsWith('data:image/') || brand.dataUrl.length > MAX_DATA_URL_CHARS) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schoolId: brand.schoolId,
        name: brand.name,
        dataUrl: brand.dataUrl,
      }),
    )
  } catch {
    /* kota veya gizli mod */
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Logo okunamadı'))
    reader.readAsDataURL(blob)
  })
}
