const STORAGE_KEY = 'okul.rememberedLogin'
const WARNING_KEY = 'okul.rememberWarningPending'

export interface RememberedLogin {
  email: string
  password: string
  /** Son girişte 2FA veya SMS doğrulaması açıktı. */
  secondFactor?: boolean
}

export function readRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>
    if (!parsed.email || !parsed.password) return null
    return {
      email: parsed.email,
      password: parsed.password,
      secondFactor: parsed.secondFactor === true ? true : parsed.secondFactor === false ? false : undefined,
    }
  } catch {
    return null
  }
}

export function writeRememberedLogin(value: RememberedLogin | null) {
  if (!value) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

/** Başarılı girişten hemen önce çağrılır; korumalı sayfa uyarıyı bir kez gösterir. */
export function armRememberedLoginWarning(active: boolean) {
  if (active) sessionStorage.setItem(WARNING_KEY, '1')
  else sessionStorage.removeItem(WARNING_KEY)
}

export function rememberedLoginWarningPending(): boolean {
  return sessionStorage.getItem(WARNING_KEY) === '1'
}

export function clearRememberedLoginWarning() {
  sessionStorage.removeItem(WARNING_KEY)
}
