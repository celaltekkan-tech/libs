'use strict';

// Yapay zekâ günlük kullanım kotası (kiracı başına). Tek Gemini anahtarının
// ücretsiz kotası tüm kiracılarca paylaşıldığı için bir kiracının kotayı
// tüketmesini engeller. AI_DAILY_LIMIT_PER_TENANT=0 sınırsız demektir.

const { sequelize, AiUsageDaily } = require('../models');

class AiQuotaError extends Error {
  constructor(limit) {
    super(`Günlük yapay zekâ kullanım sınırına ulaşıldı (${limit} istek). Yarın tekrar deneyin.`);
    this.status = 429;
    this.code = 'AI_DAILY_LIMIT';
  }
}

function dailyLimit() {
  const n = Number(process.env.AI_DAILY_LIMIT_PER_TENANT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 30;
}

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

/** Lisansa özel sınır varsa o, yoksa sistem varsayılanı. 0 = sınırsız. */
function resolveLimit(license) {
  const own = license?.ai_daily_limit;
  return own == null ? dailyLimit() : own;
}

async function getUsage(tenantId, limit = dailyLimit()) {
  const row = await AiUsageDaily.findOne({ where: { tenant_id: tenantId, usage_date: today() } });
  return { used: row?.used || 0, limit };
}

/**
 * Bir istek hakkı düşer. Artırma tek SQL ile yapılır; eşzamanlı isteklerde
 * sınır aşılamaz. Sınır doluysa AiQuotaError fırlatır.
 */
async function consume(tenantId, limit = dailyLimit()) {
  const [rows] = await sequelize.query(
    `INSERT INTO "AiUsageDaily" (tenant_id, usage_date, used, created_at, updated_at)
     VALUES (:tenantId, :day, 1, now(), now())
     ON CONFLICT (tenant_id, usage_date)
     DO UPDATE SET used = "AiUsageDaily".used + 1, updated_at = now()
     WHERE :limit = 0 OR "AiUsageDaily".used < :limit
     RETURNING used`,
    { replacements: { tenantId, day: today(), limit } }
  );
  if (!rows.length) throw new AiQuotaError(limit);
  return { used: rows[0].used, limit };
}

/** Yapay zekâ servisi hata verdiyse düşülen hak iade edilir. */
async function refund(tenantId) {
  await sequelize.query(
    `UPDATE "AiUsageDaily" SET used = used - 1, updated_at = now()
     WHERE tenant_id = :tenantId AND usage_date = :day AND used > 0`,
    { replacements: { tenantId, day: today() } }
  );
}

module.exports = { AiQuotaError, dailyLimit, resolveLimit, getUsage, consume, refund };
