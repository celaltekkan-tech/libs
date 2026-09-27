'use strict';

const path = require('path');
const { fork } = require('child_process');

const WORKER = path.join(__dirname, 'lessonPoolParseWorker.js');
const TIMEOUT_MS = Number(process.env.LESSON_POOL_PARSE_TIMEOUT_MS || 90000);
const MAX_MEMORY_MB = Number(process.env.LESSON_POOL_PARSE_MAX_MB || 768);

/**
 * Dosyayı alt süreçte ayrıştırır. Alt süreç çöker, bellek sınırını aşar ya da süre
 * dolarsa API ayakta kalır ve anlaşılır bir hata döner.
 */
function parseInChild(buffer, filename) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER, [], {
      execArgv: [`--max-old-space-size=${MAX_MEMORY_MB}`],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.connected) child.disconnect();
      if (child.exitCode === null) child.kill('SIGKILL');
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`Dosya ${Math.round(TIMEOUT_MS / 1000)} saniyede okunamadı`)),
      TIMEOUT_MS
    );

    child.on('message', (msg) => {
      if (msg && msg.ok) finish(resolve, msg.sheets);
      else finish(reject, new Error((msg && msg.error) || 'Dosya okunamadı'));
    });
    child.on('error', (err) => finish(reject, err));
    child.on('exit', (code, signal) => {
      if (settled) return;
      const why = signal ? `sinyal ${signal}` : `çıkış kodu ${code}`;
      console.error(`[lesson-pools] ayrıştırma süreci beklenmedik şekilde sonlandı (${why})`);
      finish(reject, new Error(`Dosya okunurken ayrıştırıcı durdu (${why})`));
    });

    child.send({ data: buffer.toString('base64'), filename });
  });
}

module.exports = { parseInChild };
