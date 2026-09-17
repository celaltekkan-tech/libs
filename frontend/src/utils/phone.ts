/** TR cep: 05xxxxxxxxx / 5xxxxxxxxx / +905xxxxxxxxx */
export function isValidMobilePhone(value: string | null | undefined): boolean {
  const digits = String(value || '').replace(/\D/g, '')
  let d = digits
  if (d.startsWith('90') && d.length === 12) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^5\d{9}$/.test(d)
}

export const MOBILE_PHONE_RULE = {
  validator: (_: unknown, value: string | undefined) => {
    if (!value || !String(value).trim()) return Promise.resolve()
    if (isValidMobilePhone(value)) return Promise.resolve()
    return Promise.reject(new Error('Geçerli bir cep telefonu girin (05xxxxxxxxx)'))
  },
}

export function requiredMobilePhoneRule(required: boolean) {
  return {
    validator: (_: unknown, value: string | undefined) => {
      const raw = value == null ? '' : String(value).trim()
      if (!raw) {
        if (required) {
          return Promise.reject(new Error('Geçerli bir cep telefonu zorunludur (05xxxxxxxxx)'))
        }
        return Promise.resolve()
      }
      if (isValidMobilePhone(raw)) return Promise.resolve()
      return Promise.reject(new Error('Geçerli bir cep telefonu girin (05xxxxxxxxx)'))
    },
  }
}
