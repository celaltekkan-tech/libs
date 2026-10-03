'use strict';

// e-Okul "Sınıf şube" kutusu: "AL - 9. Sınıf / A Şubesi (-)"
// Meslek lisesinde aynı harf iki programda birden durur: "AMP - 9. Sınıf / A" ve "ATP - 9. Sınıf / A".
const FULL_LABEL =
  /^([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,12})\s*[-–—]\s*(\d{1,2})\s*\.?\s*S[ıiİI]n[ıiİI]f\s*\/\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,6})\s*[Şş]ube/i;

function upper(value) {
  return String(value || '').toLocaleUpperCase('tr-TR');
}

function parseEokulClassLabel(text) {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return null;
  const folded = raw.toLocaleLowerCase('tr-TR');
  if (folded === 'seçiniz' || folded.startsWith('seçiniz') || folded === 'seciniz' || folded.startsWith('seciniz')) {
    return null;
  }

  const full = raw.match(FULL_LABEL);
  if (full) {
    return {
      program: upper(full[1]),
      class_level: String(Number(full[2])),
      section: upper(full[3]),
      raw,
    };
  }

  const simple = raw.match(/(\d{1,2})\s*[\/\-]\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,6})\b/);
  if (!simple) return null;
  return {
    program: null,
    class_level: String(Number(simple[1])),
    section: upper(simple[2]),
    raw,
  };
}

/**
 * Tek program (Anadolu lisesi, hepsi AL) şubeyi 9/A olarak bırakır; kayıtlı sınıflarla çakışmaz.
 * Birden fazla program (AMP ve ATP) şubeyi AMP-A diye yazar; ikisi de 9/A sanılmaz.
 */
function planClassrooms(labels) {
  const parsed = [];
  for (const label of labels || []) {
    const row = parseEokulClassLabel(label);
    if (row && row.class_level && row.section) parsed.push(row);
  }

  const programs = [...new Set(parsed.map((row) => row.program).filter(Boolean))];
  const multi = programs.length > 1;
  const seen = new Set();
  const classrooms = [];
  let skipped = 0;

  for (const row of parsed) {
    const section = multi && row.program ? `${row.program}-${row.section}` : row.section;
    if (!section || section.length > 20) {
      skipped += 1;
      continue;
    }
    const key = `${row.class_level}|${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    classrooms.push({
      class_level: row.class_level,
      section,
      program: multi ? row.program : null,
      label: `${row.class_level}/${section}`,
    });
  }

  classrooms.sort((a, b) => {
    const level = String(a.class_level).localeCompare(String(b.class_level), 'tr', { numeric: true });
    if (level) return level;
    return String(a.section).localeCompare(String(b.section), 'tr', { sensitivity: 'base' });
  });

  return {
    multi_program: multi,
    programs,
    classrooms,
    parsed_count: parsed.length,
    skipped,
  };
}

module.exports = { parseEokulClassLabel, planClassrooms };
