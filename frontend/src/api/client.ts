import axios, { type AxiosError } from 'axios'
import type { ApiErrorBody } from '../types/auth'

const TOKEN_KEY = 'lise_idari.token'
const EXPIRES_KEY = 'lise_idari.expires_at'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredExpiry(): string | null {
  return localStorage.getItem(EXPIRES_KEY)
}

export function persistSession(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRES_KEY, expiresAt)
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

export function isTokenExpired(expiresAt = getStoredExpiry()): boolean {
  if (!expiresAt) return false
  return Date.parse(expiresAt) <= Date.now()
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

function friendlyFallback(status: number, axiosMessage?: string): string {
  if (!status) {
    return 'Sunucuya bağlanılamadı. Backend servisinin çalıştığından emin olun (port 4000).'
  }
  if (status === 404) {
    return 'API bulunamadı (404). Backend bu projenin servisi olarak port 4000 üzerinde çalışmalı.'
  }
  if (status === 429) {
    return 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.'
  }
  return axiosMessage || 'Beklenmeyen bir hata oluştu'
}

export class ApiError extends Error {
  status: number
  code?: string
  fields?: Array<{ field: string; message: string }>

  constructor(status: number, body?: ApiErrorBody | null, fallback?: string) {
    const fromApi = typeof body?.message === 'string' ? body.message : null
    super(fromApi || friendlyFallback(status, fallback))
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code
    this.fields = body?.errors
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Beklenmeyen bir hata oluştu'
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const url = config.url || ''
  const isPublicAuth = url.includes('/api/auth/login') || url.includes('/api/auth/register')
  const token = getStoredToken()
  if (token && !isPublicAuth) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const apiError = new ApiError(status, body, error.message)

    const hadToken = Boolean(error.config?.headers?.Authorization)
    const sessionCodes = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_DISABLED']

    if (hadToken && (sessionCodes.includes(apiError.code || '') || status === 401)) {
      onUnauthorized?.()
    }

    return Promise.reject(apiError)
  },
)

export default client
