import axios, { type AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type { ApiErrorBody } from '../types/api';

const TOKEN_KEY = 'libs_mobil.token';
const SERVER_URL_KEY = 'libs_mobil.server_url';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function persistToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Sunucu adresi APK'ya gömülmüyor; ilk açılışta kullanıcıdan alınıp cihazda
// saklanır (bkz. ServerConfigContext / ServerSetupScreen). Böylece backend
// adresi değiştiğinde uygulamayı yeniden derlemeye gerek kalmaz.
let currentBaseUrl: string | null = null;

export function setApiBaseUrl(url: string | null): void {
  currentBaseUrl = url;
}

export function getApiBaseUrl(): string | null {
  return currentBaseUrl;
}

export async function getStoredServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_URL_KEY);
}

export async function persistServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
  setApiBaseUrl(url);
}

export async function clearServerUrl(): Promise<void> {
  await SecureStore.deleteItemAsync(SERVER_URL_KEY);
  setApiBaseUrl(null);
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

const client = axios.create({ timeout: 15000 });

client.interceptors.request.use(async (config) => {
  config.baseURL = currentBaseUrl || undefined;

  const url = config.url || '';
  const isPublicAuth =
    url.includes('/api/auth/login') || url.includes('/api/auth/teacher-register');
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
      ? `Sunucuya bağlanılamadı (${currentBaseUrl || 'adres tanımsız'}). Sunucu adresini ve ağ bağlantınızı kontrol edin.`
      : error.message;
    const apiError = new ApiError(status, body, fallback);
    const reqUrl = String(error.config?.url || '');
    if (status === 401 && !reqUrl.includes('/api/auth/teacher-register')) {
      onUnauthorized?.();
    }

    return Promise.reject(apiError);
  },
);

export default client;
