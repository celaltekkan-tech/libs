export const NATIONAL_ID_PATTERN = /^\d{11}$/

export function digitsOnlyNationalId(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

export function isValidNationalId(value: string | null | undefined): boolean {
  return NATIONAL_ID_PATTERN.test(String(value || '').replace(/\D/g, ''))
}

export const NATIONAL_ID_RULE = {
  validator: (_: unknown, value: string | undefined) => {
    if (!value || !String(value).trim()) return Promise.resolve()
    if (isValidNationalId(value)) return Promise.resolve()
    return Promise.reject(new Error('T.C. kimlik no 11 haneli sayı olmalıdır'))
  },
}
