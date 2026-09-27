'use strict';

const { sequelize, Subject, SubjectClassHour } = require('../models');
const { normalizeSubjectName } = require('./subjectFromBranchService');

const KINDS = ['ortak', 'secmeli', 'rehberlik'];

/** Karşılaştırma anahtarı: küçük harf, şapkasız ("Ahlâk" = "Ahlak"), tek tip kesme işareti. */
function nameKey(name) {
  return normalizeSubjectName(name)
    .toLocaleLowerCase('tr-TR')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[’`´]/g, "'");
}

/**
 * Şablon derslerini okulun mevcut dersleriyle eşleştirir.
 * Önce aynı ad (şapka/harf farkı gözetmeden); yoksa okuldaki ders adı şablon adının
 * başıysa ("Beden Eğitimi" ⊂ "Beden Eğitimi ve Spor") öneri olarak, en kısa şablon adına.
 * Dönüş: { [şablonDersAdı]: { subject_id, match: 'exact'|'similar' } }
 */
function suggestMatches(items, subjects) {
  const byKey = new Map(subjects.map((s) => [nameKey(s.name), s]));
  const out = {};
  const used = new Set();
  for (const it of items) {
    const s = byKey.get(nameKey(it.name));
    if (s) {
      out[it.name] = { subject_id: s.id, match: 'exact' };
      used.add(s.id);
    }
  }
  const sorted = [...items].filter((it) => !out[it.name]).sort((a, b) => a.name.length - b.name.length);
  for (const s of subjects) {
    if (used.has(s.id)) continue;
    const key = nameKey(s.name);
    if (key.length < 4) continue;
    const it = sorted.find((x) => !out[x.name] && nameKey(x.name).startsWith(`${key} `));
    if (it) {
      out[it.name] = { subject_id: s.id, match: 'similar' };
      used.add(s.id);
    }
  }
  return out;
}

/** Şablon kalemlerini temizler; geçersiz saat ve boş adlar atılır. */
function sanitizeItems(items, levels) {
  const levelSet = new Set(levels);
  const seen = new Set();
  const out = [];
  for (const [i, raw] of (items || []).entries()) {
    const name = normalizeSubjectName(raw.name);
    if (!name || name.length > 100) continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const hours = {};
    for (const [level, list] of Object.entries(raw.hours || {})) {
      if (!levelSet.has(level)) continue;
      const clean = [...new Set((Array.isArray(list) ? list : [list]).map(Number))]
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 40)
        .sort((a, b) => a - b);
      if (clean.length) hours[level] = clean;
    }
    const maxTakes = Number(raw.max_takes);
    out.push({
      sort_order: i + 1,
      name,
      kind: KINDS.includes(raw.kind) ? raw.kind : 'ortak',
      category: raw.category ? normalizeSubjectName(raw.category).slice(0, 100) : null,
      max_takes: Number.isInteger(maxTakes) && maxTakes > 0 && maxTakes <= 20 ? maxTakes : null,
      hours,
    });
  }
  return out;
}

/**
 * Şablonu okulun (tenant) ders havuzuna aktarır.
 * levelMap: { şablonSeviyesi: şubeSeviyesi } — yalnız eşlenen seviyeler aktarılır.
 * mode 'merge': mevcut saatlere dokunmaz, eksik saat seçeneklerini ekler.
 * mode 'replace': aktarılan ders+seviyelerin mevcut saatlerini şablondakiyle değiştirir.
 */
async function importTemplate({ tenantId, template, levelMap, mode = 'merge', kinds = KINDS, subjectMap = null }) {
  const stats = { subjects_created: 0, subjects_updated: 0, hours_created: 0, hours_removed: 0, skipped: 0 };
  const items = (template.items || []).filter((it) => kinds.includes(it.kind));

  await sequelize.transaction(async (transaction) => {
    const existing = await Subject.findAll({ where: { tenant_id: tenantId }, transaction });
    const byKey = new Map(existing.map((s) => [nameKey(s.name), s]));
    const byId = new Map(existing.map((s) => [s.id, s]));
    // Kullanıcının seçtiği eşleştirme; verilmezse ada göre eşleşir. 0 = yeni ders aç.
    const map = subjectMap || Object.fromEntries(
      Object.entries(suggestMatches(items, existing)).map(([k, v]) => [k, v.subject_id]),
    );

    for (const it of items) {
      const levels = Object.entries(it.hours || {})
        .map(([level, hours]) => ({ target: levelMap[level], hours }))
        .filter((x) => x.target);
      if (!levels.length) {
        stats.skipped += 1;
        continue;
      }

      const chosen = map[it.name];
      // Birebir aynı adlı ders zaten varsa yeni ders açılamaz; o kullanılır.
      let subject = (chosen && byId.get(Number(chosen))) || byKey.get(nameKey(it.name));
      const flags = {
        is_elective: it.kind === 'secmeli',
        is_guidance: it.kind === 'rehberlik',
        ...(it.max_takes ? { max_takes: it.max_takes } : {}),
      };
      if (!subject) {
        subject = await Subject.create({ tenant_id: tenantId, name: it.name, is_active: true, ...flags }, { transaction });
        byKey.set(nameKey(it.name), subject);
        stats.subjects_created += 1;
      } else {
        const patch = {};
        for (const [k, v] of Object.entries(flags)) if (subject[k] !== v && (v || mode === 'replace')) patch[k] = v;
        if (!subject.is_active) patch.is_active = true;
        if (Object.keys(patch).length) {
          await subject.update(patch, { transaction });
          stats.subjects_updated += 1;
        }
      }

      for (const { target, hours } of levels) {
        const where = { tenant_id: tenantId, subject_id: subject.id, class_level: target };
        const current = await SubjectClassHour.findAll({ where, transaction });
        if (mode === 'replace') {
          const drop = current.filter((h) => !hours.includes(h.weekly_hours));
          if (drop.length) {
            await SubjectClassHour.destroy({ where: { id: drop.map((h) => h.id) }, transaction });
            stats.hours_removed += drop.length;
          }
        }
        const have = new Set(current.map((h) => h.weekly_hours));
        for (const h of hours) {
          if (have.has(h)) continue;
          await SubjectClassHour.create({ ...where, weekly_hours: h }, { transaction });
          stats.hours_created += 1;
        }
      }
    }
  });
  return stats;
}

module.exports = { KINDS, nameKey, sanitizeItems, suggestMatches, importTemplate };
