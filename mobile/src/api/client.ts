import axios, { type AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';
import type { ApiErrorBody } from '../types/api';

const TOKEN_KEY = 'libs_mobil.token';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function persistToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Array<{ field: string; message: string }>;

  constructor(status: number, body?: ApiErrorBody | null, fallback?: string) {
    const fromApi = typeof body?.message === 'string' ? body.message : null;
    super(fromApi || fallback || 'Beklenmeyen bir hata oluştu');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code;
    this.fields = body?.errors;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu';
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  const url = config.url || '';
  const isPublicAuth = url.includes('/api/auth/login');
  if (!isPublicAuth) {
    const token = await getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const fallback = !status
      ? `Sunucuya bağlanılamadı (${API_BASE_URL}). Backend adresini ve ağ bağlantınızı kontrol edin.`
      : error.message;
    const apiError = new ApiError(status, body, fallback);

    if (status === 401) {
      onUnauthorized?.();
    }

    return Promise.reject(apiError);
  },
);

export default client;
