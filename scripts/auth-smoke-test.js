/**
 * Auth uçlarının uçtan uca çalıştığını doğrulayan basit duman testi.
 * Kullanım: sunucu ayaktayken `node scripts/auth-smoke-test.js`
 */
require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@okul.local';
const PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Admin1234';

let failures = 0;

function check(name, condition, detail) {
  const status = condition ? 'BASARILI' : 'BASARISIZ';
  if (!condition) failures += 1;
  console.log(`[${status}] ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

(async () => {
  const health = await call('GET', '/health');
  check('Health endpoint', health.status === 200, `status ${health.status}`);

  const badLogin = await call('POST', '/api/auth/login', {
    body: { email: EMAIL, password: 'yanlis_sifre_123' },
  });
  check(
    'Hatali sifre 401 donuyor',
    badLogin.status === 401 && badLogin.body?.code === 'INVALID_CREDENTIALS',
    `status ${badLogin.status}, code ${badLogin.body?.code}`
  );

  const invalidEmail = await call('POST', '/api/auth/login', {
    body: { email: 'gecersiz', password: 'x' },
  });
  check(
    'Validasyon hatasi 400 donuyor',
    invalidEmail.status === 400,
    `status ${invalidEmail.status}`
  );

  const login = await call('POST', '/api/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  check('Login basarili', login.status === 200, `status ${login.status}`);

  const token = login.body?.data?.token;
  check('Token dondu', Boolean(token));
  check('Token son kullanma tarihi dondu', Boolean(login.body?.data?.expires_at));
  check(
    'Izinler dondu',
    Array.isArray(login.body?.data?.permissions) && login.body.data.permissions.length > 0,
    `${login.body?.data?.permissions?.length} izin`
  );
  check(
    'Roller dondu',
    Array.isArray(login.body?.data?.roles),
    JSON.stringify(login.body?.data?.roles)
  );
  check(
    'Sifre hash sizmiyor',
    login.body?.data?.user && !('password_hash' in login.body.data.user)
  );

  const meWithoutToken = await call('GET', '/api/auth/me');
  check(
    'Tokensiz /me 401',
    meWithoutToken.status === 401 && meWithoutToken.body?.code === 'TOKEN_MISSING',
    `code ${meWithoutToken.body?.code}`
  );

  const meBadToken = await call('GET', '/api/auth/me', { token: 'bozuk.token.degeri' });
  check(
    'Gecersiz token 401 TOKEN_INVALID',
    meBadToken.status === 401 && meBadToken.body?.code === 'TOKEN_INVALID',
    `code ${meBadToken.body?.code}`
  );

  const me = await call('GET', '/api/auth/me', { token });
  check('/me basarili', me.status === 200, `status ${me.status}`);
  check('/me kullanici dondu', me.body?.data?.user?.email === EMAIL, me.body?.data?.user?.email);

  const users = await call('GET', '/api/users', { token });
  check('Yetkili kullanici listesi', users.status === 200, `status ${users.status}`);

  const schools = await call('GET', '/api/schools', { token });
  check('Yetkili okul listesi', schools.status === 200, `status ${schools.status}`);

  const register = await call('POST', '/api/auth/register', {
    body: {
      tenant_id: 1,
      full_name: 'Test Kullanici',
      email: `test${Date.now()}@okul.local`,
      password: 'Test12345',
    },
  });
  check(
    'Public register kapali',
    register.status === 403 && register.body?.code === 'REGISTRATION_DISABLED',
    `status ${register.status}`
  );

  const notFound = await call('GET', '/api/olmayan-uc');
  check('404 handler', notFound.status === 404, `status ${notFound.status}`);

  console.log('');
  if (failures === 0) {
    console.log('Tum kontroller basarili.');
  } else {
    console.log(`${failures} kontrol basarisiz.`);
    process.exitCode = 1;
  }
})();
