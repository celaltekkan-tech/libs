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
  message?: string;
}

export interface RegisterOption {
  id: number;
  name: string;
}

export interface TeacherRegisterStartResult {
  pending_token: string;
  expires_at: string;
  email_hint: string;
  email_sent: boolean;
  email_error: string | null;
  code_expires_at: string;
  requests_remaining: number;
  max_requests: number;
}

export interface TeacherRegisterSmsResult {
  phone_hint: string;
  code_expires_at: string;
  requests_remaining: number;
  max_requests: number;
}

function sessionFromPayload(payload: LoginResponseData): AuthSession {
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

export async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await client.post<Envelope<LoginResponseData>>('/api/auth/login', { email, password });
  return sessionFromPayload(data.data);
}

export async function fetchCurrentSession(): Promise<{ user: SessionUser; permissions: string[] }> {
  const { data } = await client.get<Envelope<MeResponseData>>('/api/auth/me');
  return { user: data.data.user, permissions: data.data.permissions || [] };
}

export async function listRegisterProvinces(): Promise<RegisterOption[]> {
  const { data } = await client.get<Envelope<RegisterOption[]>>('/api/auth/teacher-register/provinces');
  return data.data;
}

export async function listRegisterDistricts(provinceId: number): Promise<RegisterOption[]> {
  const { data } = await client.get<Envelope<RegisterOption[]>>('/api/auth/teacher-register/districts', {
    params: { province_id: provinceId },
  });
  return data.data;
}

export async function listRegisterSchools(provinceId: number, districtId: number): Promise<RegisterOption[]> {
  const { data } = await client.get<Envelope<RegisterOption[]>>('/api/auth/teacher-register/schools', {
    params: { province_id: provinceId, district_id: districtId },
  });
  return data.data;
}

export async function startTeacherRegister(payload: {
  school_id: number;
  personnel_no: string;
  last_name: string;
  email: string;
}): Promise<TeacherRegisterStartResult> {
  const { data } = await client.post<Envelope<TeacherRegisterStartResult>>('/api/auth/teacher-register', payload);
  return data.data;
}

export async function resendTeacherRegisterEmail(pendingToken: string): Promise<TeacherRegisterStartResult> {
  const { data } = await client.post<Envelope<TeacherRegisterStartResult>>(
    '/api/auth/teacher-register/resend-email',
    { pending_token: pendingToken },
  );
  return data.data;
}

export async function requestTeacherRegisterSms(
  pendingToken: string,
  phone: string,
): Promise<TeacherRegisterSmsResult> {
  const { data } = await client.post<Envelope<TeacherRegisterSmsResult>>('/api/auth/teacher-register/request-sms', {
    pending_token: pendingToken,
    phone,
  });
  return data.data;
}

export async function verifyTeacherRegister(pendingToken: string, code: string): Promise<AuthSession> {
  const { data } = await client.post<Envelope<LoginResponseData>>('/api/auth/teacher-register/verify', {
    pending_token: pendingToken,
    code,
  });
  return sessionFromPayload(data.data);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ token: string; expires_at: string }> {
  const { data } = await client.post<Envelope<{ token: string; expires_at: string }>>('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data.data;
}
