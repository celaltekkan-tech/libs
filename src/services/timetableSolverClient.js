'use strict';

// solver/ (Python FastAPI + OR-Tools) servisine HTTP istemcisi.
// Docker Compose SOLVER_URL=http://solver:8000 verir. Yerelde varsayılan 127.0.0.1'dir;
// "solver" adı yalnız Docker iç ağında çözülür.

const SOLVER_URL = (
  process.env.SOLVER_URL || (process.env.NODE_ENV === 'production' ? 'http://solver:8000' : 'http://127.0.0.1:8000')
).replace(/\/$/, '');

class SolverUnavailableError extends Error {}

async function request(method, path, body, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${SOLVER_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const reason = (err && err.cause && err.cause.code) || (err && err.code) || (err && err.message) || 'bağlantı hatası';
    console.warn(`[solver] ${method} ${path} başarısız (${SOLVER_URL}): ${reason}`);
    throw new SolverUnavailableError(
      `Program çözücü servisine ulaşılamadı (${SOLVER_URL}). Servisin çalıştığından emin olun.`
    );
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) {
    const err = new Error('Çözücü işi bulunamadı');
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Çözücü hatası (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

module.exports = {
  SolverUnavailableError,
  check: (payload) => request('POST', '/check', payload, 60000),
  createJob: (payload) => request('POST', '/jobs', payload),
  getJob: (jobId) => request('GET', `/jobs/${jobId}`),
  cancelJob: (jobId) => request('DELETE', `/jobs/${jobId}`),
  health: () => request('GET', '/health', null, 5000),
};
