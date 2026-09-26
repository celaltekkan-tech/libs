'use strict';

// Kullanıcının serbest metinle yazdığı ders programı isteklerini
// ("Ayşe Hoca cuma gelmesin") yapılandırılmış kısıtlara çevirir.
// Programı Gemini üretmez; yalnızca kısıt önerir, kullanıcı onaylar,
// OR-Tools çözer. Gemini'ye TC/telefon gibi kişisel veri gönderilmez;
// yalnızca id + ad soyad + branş gider.

const { TYPES, normalizeParams, describe } = require('./timetableConstraintCatalog');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function config() {
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 45000,
  };
}

function isEnabled() {
  return Boolean(config().apiKey);
}

class GeminiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const idProp = { type: 'INTEGER', nullable: true };
const intList = { type: 'ARRAY', items: { type: 'INTEGER' } };

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    constraints: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: Object.keys(TYPES) },
          is_hard: { type: 'BOOLEAN' },
          weight: { type: 'INTEGER', nullable: true },
          explanation: { type: 'STRING' },
          params: {
            type: 'OBJECT',
            properties: {
              teacher_id: idProp,
              classroom_id: idProp,
              room_id: idProp,
              subject_id: idProp,
              slots: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: { day: { type: 'INTEGER' }, periods: intList },
                  required: ['day'],
                },
              },
              max: { type: 'INTEGER', nullable: true },
              count: { type: 'INTEGER', nullable: true },
              mode: { type: 'STRING', enum: ['only', 'avoid'], nullable: true },
              periods: intList,
              days: intList,
            },
          },
        },
        required: ['type', 'is_hard', 'params', 'explanation'],
      },
    },
    unresolved: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['constraints', 'unresolved'],
};

function systemPrompt(ctx) {
  const dayList = ctx.days.map((d) => `${d}=${ctx.dayNames[d]}`).join(', ');
  return `Sen bir okul ders programı asistanısın. Kullanıcının Türkçe isteğini aşağıdaki kısıt türlerine çevir.
Programı SEN yapmıyorsun; yalnızca kısıt çıkarıyorsun. Kısıtları bir matematiksel çözücü uygulayacak.

Günler: ${dayList}. Günde ${ctx.periods} ders saati var (1..${ctx.periods}).${
    ctx.lunchAfter ? ` Öğle arası ${ctx.lunchAfter}. saatten sonra.` : ''
  }
"Sabah" = 1..${ctx.lunchAfter || Math.ceil(ctx.periods / 2)}. saatler, "öğleden sonra" = ${
    (ctx.lunchAfter || Math.ceil(ctx.periods / 2)) + 1
  }..${ctx.periods}. saatler, "son saat(ler)" = son 1-2 saat, "ilk saat" = 1.

Kısıt türleri ve params alanları:
- teacher_unavailable: teacher_id (null=tüm öğretmenler), slots=[{day, periods}] (periods boş = tüm gün). "X gelmesin/müsait değil/izinli".
- classroom_unavailable: classroom_id, slots. Şubenin o saatlerde dersi olmasın.
- room_unavailable: room_id, slots. Mekan (laboratuvar, spor salonu vb.) kullanılamaz.
- teacher_max_daily_hours: teacher_id (null=tümü), max.
- teacher_min_days_off: teacher_id (null=tümü), count. "boş gün istiyor" -> count=1.
- teacher_max_consecutive: teacher_id (null=tümü), max. Üst üste en fazla kaç saat.
- subject_period_preference: subject_id, classroom_id (null=tüm şubeler), mode ("only"=yalnızca bu saatlerde, "avoid"=bu saatlere konmasın), periods, days (boş=tüm günler).
- subject_max_daily: subject_id, classroom_id (null=tümü), max.

is_hard: Kullanıcı "kesinlikle, asla, olmasın, gelemez, izinli, raporlu" gibi kesin ifade kullanırsa true.
"Tercihen, mümkünse, olursa iyi olur, istiyor, rica etti" gibi yumuşak ifadelerde false ve weight 10-50 arası (önem arttıkça yüksek).
Belirsizse öğretmen talepleri için false, kurumsal kurallar için true seç.

Aşağıdaki listelerden id seç. İsim eşleşmesi yaklaşık olabilir (Ayşe Hoca -> Ayşe Yılmaz; "matematikçi Ali" -> branşı matematik olan Ali).
Birden fazla aday varsa veya eşleşme yoksa, o isteği kısıta çevirme; "unresolved" listesine Türkçe açıklamayla yaz.
Desteklenmeyen istekleri de (ör. öğretmen değiştirme, ders saati değiştirme) "unresolved" listesine yaz.
explanation alanına kısıtın Türkçe kısa açıklamasını yaz.

ÖĞRETMENLER (id|ad|branş):
${ctx.teachers.map((t) => `${t.id}|${t.name}|${t.brans || ''}`).join('\n')}

ŞUBELER (id|ad):
${ctx.classrooms.map((c) => `${c.id}|${c.label}`).join('\n')}

DERSLER (id|ad):
${ctx.subjects.map((s) => `${s.id}|${s.name}`).join('\n')}

MEKANLAR (id|ad):
${ctx.rooms.map((r) => `${r.id}|${r.name}`).join('\n') || '(yok)'}`;
}

async function callGemini(system, userText) {
  const { apiKey, model, timeoutMs } = config();
  if (!apiKey) throw new GeminiError('Gemini API anahtarı tanımlı değil (GEMINI_API_KEY)', 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new GeminiError(
      err.name === 'AbortError' ? 'Gemini yanıt vermedi (zaman aşımı)' : `Gemini'ye bağlanılamadı: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    throw new GeminiError('Gemini ücretsiz kullanım kotası doldu. Bir süre sonra tekrar deneyin.', 429);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new GeminiError(`Gemini hatası: ${msg}`);
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini geçersiz yanıt döndürdü');
  }
}

/**
 * ctx: { days, periods, lunchAfter, dayNames, teachers:[{id,name,brans}],
 *        classrooms:[{id,label}], subjects:[{id,name}], rooms:[{id,name}] }
 * Dönüş: { proposals: [{type,is_hard,weight,params,explanation,summary}], unresolved: [string] }
 */
async function parseConstraints(ctx, userText) {
  const raw = await callGemini(systemPrompt(ctx), userText);
  const ids = {
    teacher_id: new Set(ctx.teachers.map((t) => t.id)),
    classroom_id: new Set(ctx.classrooms.map((c) => c.id)),
    subject_id: new Set(ctx.subjects.map((s) => s.id)),
    room_id: new Set(ctx.rooms.map((r) => r.id)),
  };
  const names = {
    teachers: Object.fromEntries(ctx.teachers.map((t) => [t.id, t.name])),
    classrooms: Object.fromEntries(ctx.classrooms.map((c) => [c.id, c.label])),
    subjects: Object.fromEntries(ctx.subjects.map((s) => [s.id, s.name])),
    rooms: Object.fromEntries(ctx.rooms.map((r) => [r.id, r.name])),
  };

  const proposals = [];
  const unresolved = Array.isArray(raw?.unresolved) ? raw.unresolved.filter((x) => typeof x === 'string') : [];

  for (const item of Array.isArray(raw?.constraints) ? raw.constraints : []) {
    try {
      const params = normalizeParams(item.type, item.params, { periods: ctx.periods });
      for (const [key, set] of Object.entries(ids)) {
        if (params[key] != null && !set.has(params[key])) {
          throw new Error(`listede olmayan ${key}=${params[key]}`);
        }
      }
      if (params.slots) {
        params.slots = params.slots.filter((s) => ctx.days.includes(s.day));
        if (!params.slots.length) throw new Error('geçerli gün yok');
      }
      const isHard = Boolean(item.is_hard);
      const weight = isHard ? null : Math.max(1, Math.min(100, Number(item.weight) || 20));
      proposals.push({
        type: item.type,
        is_hard: isHard,
        weight,
        params,
        explanation: item.explanation || '',
        summary: describe(item.type, params, names),
      });
    } catch (err) {
      unresolved.push(`${item.explanation || item.type}: anlaşılamadı (${err.message})`);
    }
  }
  return { proposals, unresolved };
}

module.exports = { isEnabled, config, parseConstraints, GeminiError };
