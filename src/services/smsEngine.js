'use strict';

const { execFile } = require('child_process');
const dgram = require('dgram');
const { normalizeMobilePhone } = require('../utils/phone');

// Bir SMS gönderiminin alabileceği durumlar. AnnouncementRecipient.status ve
// benzeri tablolarda bu sabitler kullanılmalı; serbest string yazılmamalı.
const SMS_STATUS = {
  PENDING: 'beklemede',
  SUCCESS: 'basarili',
  FAILED: 'basarisiz',
  CANCELLED: 'iptal',
};

class SmsConfigError extends Error {}

function truncate(str, max = 500) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// --- Sağlayıcı 1: Harici program (CLI) ---------------------------------
// Konfigüre edilmiş bir çalıştırılabiliri (SMS_EXTERNAL_PROGRAM_PATH) telefon
// ve mesajı parametre olarak vererek çalıştırır. Programın stdout'a tek
// satırlık JSON döndürmesi beklenir: {"success": true|false, "messageId": "...", "error": "..."}
async function externalCliProvider(phoneNumber, message) {
  const programPath = process.env.SMS_EXTERNAL_PROGRAM_PATH;
  if (!programPath) {
    throw new SmsConfigError('SMS_EXTERNAL_PROGRAM_PATH tanımlı değil');
  }

  const timeoutMs = Number(process.env.SMS_EXTERNAL_PROGRAM_TIMEOUT_MS) || 15000;

  // Argüman şablonu isteğe bağlı: örn. '["--to","{phone}","--text","{message}"]'
  // Verilmezse varsayılan olarak [telefon, mesaj] geçirilir.
  let args = [phoneNumber, message];
  const template = process.env.SMS_EXTERNAL_PROGRAM_ARGS;
  if (template) {
    let parsedTemplate;
    try {
      parsedTemplate = JSON.parse(template);
    } catch (err) {
      throw new SmsConfigError(`SMS_EXTERNAL_PROGRAM_ARGS geçerli bir JSON dizisi değil: ${err.message}`);
    }
    if (!Array.isArray(parsedTemplate)) {
      throw new SmsConfigError('SMS_EXTERNAL_PROGRAM_ARGS bir JSON dizisi olmalı');
    }
    args = parsedTemplate.map((arg) =>
      String(arg).replace('{phone}', phoneNumber).replace('{message}', message)
    );
  }

  return new Promise((resolve) => {
    execFile(
      programPath,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const output = (stdout || '').trim();

        if (err) {
          resolve({
            success: false,
            providerMessageId: null,
            error: truncate(err.killed ? 'Program zaman aşımına uğradı' : stderr || err.message || output),
          });
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(output);
        } catch {
          resolve({
            success: false,
            providerMessageId: null,
            error: `Programdan geçerli JSON çıktısı alınamadı: ${truncate(output || stderr)}`,
          });
          return;
        }

        resolve({
          success: parsed.success === true,
          providerMessageId: parsed.messageId ?? null,
          error: parsed.success === true ? null : truncate(parsed.error || 'Program başarısız sonuç döndürdü'),
        });
      }
    );
  });
}

// --- Sağlayıcı 2: Genel HTTP toplu SMS adaptörü ------------------------
// Belirli bir toplu SMS firmasına bağlı değildir; istek/yanıt şekli env
// değişkenleriyle uyarlanır. Firma netleşince buraya özel bir sağlayıcı
// (örn. netgsmProvider) eklenip SMS_PROVIDER ile seçilebilir.
async function httpApiProvider(phoneNumber, message) {
  const url = process.env.SMS_HTTP_URL;
  if (!url) {
    throw new SmsConfigError('SMS_HTTP_URL tanımlı değil');
  }

  const method = process.env.SMS_HTTP_METHOD || 'POST';
  const timeoutMs = Number(process.env.SMS_HTTP_TIMEOUT_MS) || 15000;
  const successField = process.env.SMS_HTTP_SUCCESS_FIELD || null;
  const messageIdField = process.env.SMS_HTTP_MESSAGE_ID_FIELD || 'messageId';
  const errorField = process.env.SMS_HTTP_ERROR_FIELD || 'error';

  let body = { to: phoneNumber, message };
  if (process.env.SMS_HTTP_BODY_TEMPLATE) {
    const filled = process.env.SMS_HTTP_BODY_TEMPLATE.replace('{phone}', phoneNumber).replace(
      '{message}',
      JSON.stringify(message).slice(1, -1)
    );
    try {
      body = JSON.parse(filled);
    } catch (err) {
      throw new SmsConfigError(`SMS_HTTP_BODY_TEMPLATE geçerli bir JSON şablonu değil: ${err.message}`);
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.SMS_HTTP_API_KEY) {
    const headerName = process.env.SMS_HTTP_API_KEY_HEADER || 'Authorization';
    headers[headerName] = process.env.SMS_HTTP_API_KEY;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Yanıt JSON değilse yalnızca HTTP durum koduna göre değerlendirilir.
    }

    const success = successField && json ? Boolean(json[successField]) : res.ok;
    return {
      success,
      providerMessageId: json ? json[messageIdField] ?? null : null,
      error: success ? null : truncate((json && json[errorField]) || `HTTP ${res.status}: ${text}`),
    };
  } catch (err) {
    return {
      success: false,
      providerMessageId: null,
      error: err.name === 'AbortError' ? 'İstek zaman aşımına uğradı' : truncate(err.message),
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- Sağlayıcı 3: UDP SMS motoru ---------------------------------------
// Yerel ağdaki SMS motoruna tek bir UDP datagramı gönderir:
//   {"phone": "+905xxxxxxxxx", "message": "..."}
// Türkçe karakterler \uXXXX olarak kaçırılır (Python json.dumps ile aynı);
// böylece alıcı json.loads da ast.literal_eval da kullansa sorunsuz çözer.
// UDP'de teslim onayı yoktur: SMS_UDP_REPLY_TIMEOUT_MS > 0 ise motordan
// JSON yanıt ({"success": ...}) beklenir, aksi halde paket gidince başarı sayılır.
function toE164Tr(phone) {
  const digits = normalizeMobilePhone(phone);
  if (digits && /^5\d{9}$/.test(digits)) return `+90${digits}`;
  const raw = String(phone).trim();
  return raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
}

function asciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

async function udpProvider(phoneNumber, message) {
  const host = process.env.SMS_UDP_HOST;
  if (!host) {
    throw new SmsConfigError('SMS_UDP_HOST tanımlı değil');
  }
  const port = Number(process.env.SMS_UDP_PORT) || 5005;
  const replyTimeoutMs = Number(process.env.SMS_UDP_REPLY_TIMEOUT_MS) || 0;
  const payload = Buffer.from(asciiJson({ phone: toE164Tr(phoneNumber), message: String(message) }), 'utf8');

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let timer = null;
    const finish = (result) => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // zaten kapalı
      }
      resolve(result);
    };

    socket.on('error', (err) => finish({ success: false, providerMessageId: null, error: truncate(err.message) }));

    if (replyTimeoutMs > 0) {
      socket.on('message', (buf) => {
        const text = buf.toString('utf8').trim();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // JSON değilse düz metin olarak değerlendir
        }
        const success = json ? json.success === true : /^(ok|success|true)$/i.test(text);
        finish({
          success,
          providerMessageId: json ? json.messageId ?? null : null,
          error: success ? null : truncate((json && json.error) || text || 'SMS motoru başarısız yanıt döndürdü'),
        });
      });
    }

    socket.send(payload, port, host, (err) => {
      if (err) {
        finish({ success: false, providerMessageId: null, error: truncate(err.message) });
        return;
      }
      if (replyTimeoutMs <= 0) {
        finish({ success: true, providerMessageId: null, error: null });
        return;
      }
      timer = setTimeout(
        () => finish({ success: false, providerMessageId: null, error: 'SMS motorundan yanıt alınamadı (zaman aşımı)' }),
        replyTimeoutMs
      );
    });
  });
}

const PROVIDERS = {
  external_cli: externalCliProvider,
  http_api: httpApiProvider,
  udp: udpProvider,
};

/**
 * Tek bir SMS gönderir ve normalize edilmiş sonucu döner. Kalıcı kayıt
 * tutmaz — çağıran taraf (örn. announcementsController) sonucu kendi
 * durum alanına (AnnouncementRecipient.status vb.) yazar.
 *
 * @returns {Promise<{status: string, providerName: string, providerMessageId: string|null, error: string|null}>}
 */
async function sendSms({ phoneNumber, message }) {
  if (!phoneNumber || !String(phoneNumber).trim()) {
    return { status: SMS_STATUS.CANCELLED, providerName: null, providerMessageId: null, error: 'Telefon numarası yok' };
  }
  if (!message || !String(message).trim()) {
    return { status: SMS_STATUS.CANCELLED, providerName: null, providerMessageId: null, error: 'Mesaj içeriği boş' };
  }

  const providerName = process.env.SMS_PROVIDER || 'external_cli';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new SmsConfigError(`Bilinmeyen SMS_PROVIDER: ${providerName}`);
  }

  try {
    const result = await provider(phoneNumber, message);
    return {
      status: result.success ? SMS_STATUS.SUCCESS : SMS_STATUS.FAILED,
      providerName,
      providerMessageId: result.providerMessageId,
      error: result.error,
    };
  } catch (err) {
    if (err instanceof SmsConfigError) throw err;
    return { status: SMS_STATUS.FAILED, providerName, providerMessageId: null, error: truncate(err.message) };
  }
}

/**
 * Aktif sağlayıcı ve gizli olmayan ayarları döner (platform SMS test ekranı için).
 * API anahtarı gibi sırlar dahil edilmez.
 */
function getSmsConfigSummary() {
  const provider = process.env.SMS_PROVIDER || 'external_cli';
  const summary = { provider, known: Boolean(PROVIDERS[provider]), settings: {} };
  if (provider === 'udp') {
    summary.settings = {
      host: process.env.SMS_UDP_HOST || null,
      port: Number(process.env.SMS_UDP_PORT) || 5005,
      reply_timeout_ms: Number(process.env.SMS_UDP_REPLY_TIMEOUT_MS) || 0,
    };
  } else if (provider === 'http_api') {
    summary.settings = {
      url: process.env.SMS_HTTP_URL || null,
      method: process.env.SMS_HTTP_METHOD || 'POST',
      api_key_set: Boolean(process.env.SMS_HTTP_API_KEY),
    };
  } else if (provider === 'external_cli') {
    summary.settings = { program_path: process.env.SMS_EXTERNAL_PROGRAM_PATH || null };
  }
  return summary;
}

module.exports = { sendSms, getSmsConfigSummary, toE164Tr, SMS_STATUS, SmsConfigError };
