import client, { ApiError } from './client';
import type { AuthSession, SessionUser } from '../types/api';

interface LoginResponseData {
  requires_2fa?: boolean;
  requires_sms?: boolean;
  token?: string;
  expires_at?: string;
  user?: SessionUser;
  permissions?: string[];
}

interface MeResponseData {
  user: SessionUser;
  permissions: string[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await client.post<Envelope<LoginResponseData>>('/api/auth/login', { email, password });
  const payload = data.data;

  if (payload.requires_2fa || payload.requires_sms) {
    throw new ApiError(
      400,
      null,
      'Bu hesapta iki adımlı doğrulama/SMS girişi açık. Mobil uygulama şu an bunu desteklemiyor; lütfen yöneticinizle iletişime geçin.',
    );
  }

  if (!payload.token || !payload.user) {
    throw new ApiError(500, null, 'Giriş yanıtı beklenmeyen biçimde geldi');
  }

  return {
    token: payload.token,
    expires_at: payload.expires_at || '',
    user: payload.user,
    permissions: payload.permissions || [],
  };
}

// Uygulama açılışında saklanan token'ın hâlâ geçerli olduğunu doğrulamak ve
// güncel kullanıcı/izin bilgisini almak için kullanılır. Token geçersizse
// client'taki 401 interceptor'ı devreye girer ve oturum otomatik kapatılır.
export async function fetchCurrentSession(): Promise<{ user: SessionUser; permissions: string[] }> {
  const { data } = await client.get<Envelope<MeResponseData>>('/api/auth/me');
  return { user: data.data.user, permissions: data.data.permissions || [] };
}
