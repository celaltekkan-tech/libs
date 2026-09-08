/**
 * Frontend origin'inden gelen isteklerin CORS ayarlarıyla uyumlu olduğunu doğrular.
 */
require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;
const ALLOWED_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
const BLOCKED_ORIGIN = 'http://kotu-site.example';

async function preflight(origin) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

  return {
    status: res.status,
    allowOrigin: res.headers.get('access-control-allow-origin'),
  };
}

(async () => {
  const allowed = await preflight(ALLOWED_ORIGIN);
  console.log(
    `[${allowed.allowOrigin === ALLOWED_ORIGIN ? 'BASARILI' : 'BASARISIZ'}] Izinli origin (${ALLOWED_ORIGIN}) -> status ${allowed.status}, allow-origin ${allowed.allowOrigin}`
  );

  const blocked = await preflight(BLOCKED_ORIGIN);
  console.log(
    `[${!blocked.allowOrigin ? 'BASARILI' : 'BASARISIZ'}] Izinsiz origin engellendi -> status ${blocked.status}, allow-origin ${blocked.allowOrigin}`
  );
})();
