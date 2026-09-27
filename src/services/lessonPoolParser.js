'use strict';

// MEB haftalık ders çizelgesini (TTK kararı PDF'i veya MEBBİS Excel çıktısı) ders
// havuzu şablonuna çevirir. PDF ve Excel önce konumlu hücre satırlarına dönüştürülür,
// ardından aynı tablo yorumlayıcısından geçer. Sonuç kaydedilmeden önce yönetici
// tarafından önizlemede düzeltilir; ayrıştırıcı tahmin yaptığı yerlerde uyarı üretir.

const XLSX = require('xlsx');

const HAZIRLIK = 'Hazırlık';
const SKIP_TITLE = /^(HAFTALIK DERS ÇİZELGESİ|DERSLER|SINIFI?)$/i;
// Toplam/sayım satırları ders değildir.
const TOTAL_ROW = /(TOPLAMI?|SAATİ SAYISI|DERS SAATİ$)/i;
const STOP_ROW = /^(PROGRAM DIŞI|ETKİNLİKLER|SOSYAL SORUMLULUK|HAYAT BOYU)/i;
const ORTAK_END = /ORTAK DERS SAATİ TOPLAMI/i;
const SECMELI_END = /SEÇİLEBİLECEK DERS SAATİ/i;
// Sol sütundaki bölüm etiketleri (ders değil).
const SECTION_LABEL = /^(ORTAK DERSLER|SEÇMELİ DERSLER|ZORUNLU DERSLER)$/i;

function clean(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trLower(s) {
  return s.toLocaleLowerCase('tr-TR');
}

const SMALL_WORDS = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki']);

/** "TÜRK DİLİ VE EDEBİYATI" -> "Türk Dili ve Edebiyatı"; "T.C." gibi kısaltmalar korunur. */
function titleCaseTr(name) {
  return name
    .split(' ')
    .map((word, i) => {
      if (/^[A-ZÇĞİÖŞÜ]\.([A-ZÇĞİÖŞÜ]\.)+$/.test(word)) return word;
      return word
        .split('/')
        .map((part) =>
          part
            .split('-')
            .map((p, j) => {
              const lower = trLower(p);
              if (i > 0 && SMALL_WORDS.has(lower)) return lower;
              // "KUR’AN-I" -> "Kur’an-ı": tire sonrası tek harf ek sayılır.
              if (j > 0 && lower.length === 1) return lower;
              return lower ? lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1) : lower;
            })
            .join('-'),
        )
        .join('/');
    })
    .join(' ');
}

/** "SEÇMELİ MATEMATİK (2)" -> { name, maxTakes: 2 }; "*" dipnot işareti atılır. */
function parseSubjectName(raw) {
  let text = clean(raw).replace(/\s*\*+\s*$/, '');
  let maxTakes = null;
  const m = text.match(/\s*\((\d{1,2})\)\s*$/);
  if (m) {
    maxTakes = Number(m[1]);
    text = text.slice(0, m.index).trim();
  }
  return { name: titleCaseTr(text), rawName: text, maxTakes };
}

/** "5" -> [5], "(3)(5)" -> [3,5], "-" -> []; seçenekli saatler seçenek listesidir. */
function parseHours(text) {
  const t = clean(text);
  if (!t || /^[-–—]+$/.test(t)) return { hours: [], options: false };
  const paren = [...t.matchAll(/\((\d{1,2})\)/g)].map((m) => Number(m[1]));
  if (paren.length) return { hours: [...new Set(paren)].filter((n) => n > 0 && n <= 40), options: true };
  const nums = [...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((n) => n > 0 && n <= 40);
  return { hours: [...new Set(nums)], options: nums.length > 1 };
}

function levelToken(text) {
  const t = clean(text).toLocaleUpperCase('tr-TR');
  if (/^HAZIRLIK( SINIFI)?$/.test(t)) return HAZIRLIK;
  const m = t.match(/^(\d{1,2})(\.)?( ?SINIF)?$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return String(Number(m[1]));
  return null;
}

// ---------------------------------------------------------------- satırlara dönüştürme

/** PDF: her sayfa ayrı çizelge adayıdır; hücreler {x, cx, y, text} konumlarıyla gelir. */
async function pdfPages(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
    isEvalSupported: false,
  }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const cells = [];
    for (const item of content.items) {
      const text = clean(item.str);
      if (!text) continue;
      const x = item.transform[4];
      const w = item.width || 0;
      cells.push({ x, xEnd: x + w, cx: x + w / 2, y: item.transform[5], text, raw: item.str });
    }
    // Aynı görsel satırdaki etiket, ders adı ve değerler 1-3 pt farklı yükseklikte
    // olabilir: y'ye göre sıralayıp ardışık yakın hücreleri zincirleme gruplarız.
    cells.sort((a, b) => b.y - a.y);
    const rows = [];
    let prevY = null;
    for (const c of cells) {
      if (prevY === null || prevY - c.y > 2.5) rows.push({ y: c.y, cells: [] });
      rows[rows.length - 1].cells.push(c);
      prevY = c.y;
    }
    for (const r of rows) {
      r.cells.sort((a, b) => a.x - b.x);
      // Bitişik parçalar tek hücreye birleşir ("KUR’AN-I" + "KERİM").
      const merged = [];
      for (const c of r.cells) {
        const prev = merged[merged.length - 1];
        // Üst üste binen (başka satırdan gelen etiket) parçalar birleşmez.
        const gap = prev ? c.x - prev.xEnd : null;
        if (prev && gap > -1 && gap < 1.5) {
          prev.text = clean(`${prev.text}${c.raw.startsWith(' ') ? ' ' : ''}${c.text}`);
          prev.xEnd = Math.max(prev.xEnd, c.xEnd);
          prev.cx = (prev.x + prev.xEnd) / 2;
        } else {
          merged.push({ ...c });
        }
      }
      r.cells = merged;
    }
    pages.push({ label: `Sayfa ${n}`, rows });
  }
  return pages;
}

/** Excel: her sayfa bir çizelge adayı; sütun indeksi konum olarak kullanılır. */
function excelPages(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map((name) => {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    const rows = data
      .map((cols, i) => ({
        y: -i,
        cells: cols
          .map((v, j) => ({ x: j * 100, cx: j * 100 + 50, xEnd: j * 100 + 100, y: -i, text: clean(v) }))
          .filter((c) => c.text),
      }))
      .filter((r) => r.cells.length);
    return { label: name, rows };
  });
}

// ---------------------------------------------------------------- tablo yorumlama

function findHeader(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const levels = rows[i].cells.map((c) => ({ c, level: levelToken(c.text) })).filter((x) => x.level);
    const others = rows[i].cells.filter((c) => !levelToken(c.text) && !/^(DERSLER|SINIFI?|DERS ADI)$/i.test(c.text));
    if (levels.length >= 2 && others.length <= 1) return { index: i, levels };
    // Excel: "9. Sınıf" başlıkları tek satırda ders adı başlığıyla gelir.
    if (levels.length >= 2 && rows[i].cells.some((c) => /^(DERSLER|DERS ADI|DERSİN ADI)$/i.test(c.text))) {
      return { index: i, levels };
    }
  }
  return null;
}

function interpretPage(page) {
  const { rows } = page;
  const header = findHeader(rows);
  if (!header) return null;
  const warnings = [];
  const levels = header.levels.map((l) => ({ level: l.level, cx: l.c.cx }));
  const valueStart = Math.min(...header.levels.map((l) => l.c.x)) - 40;
  const colWidth =
    levels.length > 1 ? Math.min(...levels.slice(1).map((l, i) => l.cx - levels[i].cx)) : 40;

  const titleLines = rows
    .slice(0, header.index)
    .map((r) => r.cells.map((c) => c.text).join(' '))
    .filter((t) => t && !SKIP_TITLE.test(t));
  const title = titleCaseTr(titleLines.join(' ').replace(/HAFTALIK DERS ÇİZELGESİ/gi, '').trim()) || page.label;

  const items = [];
  const categoryFragments = [];
  let section = 'ortak';
  let order = 0;

  for (const row of rows.slice(header.index + 1)) {
    if (/^(SINIFI?|DERSLER)$/i.test(row.cells[0]?.text || '') && row.cells.every((c) => /^(SINIFI?|DERSLER)$/i.test(c.text))) continue;
    const texts = row.cells.filter((c) => c.x < valueStart);
    const values = row.cells.filter((c) => c.x >= valueStart);
    const full = texts.map((c) => c.text).join(' ');
    if (STOP_ROW.test(full)) break;
    if (ORTAK_END.test(full)) {
      section = 'secmeli';
      continue;
    }
    if (SECMELI_END.test(full)) {
      section = 'sonrasi';
      continue;
    }
    if (TOTAL_ROW.test(full)) continue;
    if (/^SEÇMELİ DERSLER$/i.test(full) && !values.length) {
      section = 'secmeli';
      continue;
    }
    if (!texts.length) continue;

    // En sağdaki metin ders adıdır; soldakiler bölüm/grup etiketi parçalarıdır.
    const nameCell = texts[texts.length - 1];
    const labels = texts.slice(0, -1).filter((c) => !SECTION_LABEL.test(c.text));
    for (const l of labels) categoryFragments.push({ y: row.y, text: l.text });
    if (!values.length) {
      if (!SECTION_LABEL.test(nameCell.text)) categoryFragments.push({ y: row.y, text: nameCell.text });
      continue;
    }
    if (SECTION_LABEL.test(nameCell.text)) continue;

    const { name, rawName, maxTakes } = parseSubjectName(nameCell.text);
    if (!name) continue;
    const hours = {};
    let hasOptions = false;
    for (const v of values) {
      let best = null;
      for (const l of levels) {
        const d = Math.abs(l.cx - v.cx);
        if (!best || d < best.d) best = { level: l.level, d };
      }
      if (!best || best.d > colWidth * 0.75) {
        warnings.push(`"${name}" satırında sütunu belirlenemeyen değer: ${v.text}`);
        continue;
      }
      const parsed = parseHours(v.text);
      if (parsed.hours.length) {
        hours[best.level] = [...new Set([...(hours[best.level] || []), ...parsed.hours])].sort((a, b) => a - b);
        hasOptions ||= parsed.options;
      }
    }
    const guidance = /REHBERLİK/i.test(rawName);
    const kind = guidance ? 'rehberlik' : section === 'secmeli' ? 'secmeli' : 'ortak';
    if (section === 'sonrasi' && !guidance) {
      warnings.push(`"${name}" toplam satırlarından sonra geldi; türünü kontrol edin.`);
    }
    items.push({
      sort_order: (order += 1),
      name,
      kind,
      category: null,
      max_takes: maxTakes,
      has_options: hasOptions,
      hours,
      _y: row.y,
    });
  }

  assignCategories(items, categoryFragments);
  for (const it of items) delete it._y;
  if (!items.length) return null;
  if (items.some((i) => i.kind === 'secmeli' && i.category)) {
    warnings.push('Seçmeli ders grupları (akademik çalışmalar vb.) konumdan tahmin edildi; sınırdaki dersleri kontrol edin.');
  }
  return { title, source: page.label, levels: levels.map((l) => l.level), items, warnings };
}

/**
 * Sol sütundaki çok satırlı grup etiketleri ("DİN, AHLAK VE" + "DEĞER") dikey olarak
 * kendi bloğunun ortasına yazılır. Bloklar ardışık olduğundan yukarıdan aşağı
 * ilerlenir: blok üstü bilinir, alt sınırı = 2 × etiket merkezi − üst.
 */
function assignCategories(items, fragments) {
  const electives = items.filter((it) => it.kind === 'secmeli').sort((a, b) => b._y - a._y);
  if (!fragments.length || !electives.length) return;
  const sorted = [...fragments].sort((a, b) => b.y - a.y);
  const groups = [];
  for (const f of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.lastY - f.y <= 16) {
      last.parts.push(f.text);
      last.lastY = f.y;
      last.ys.push(f.y);
    } else {
      groups.push({ parts: [f.text], lastY: f.y, ys: [f.y] });
    }
  }
  const labels = groups
    .map((g) => ({ name: titleCaseTr(g.parts.join(' ')), y: (g.ys[0] + g.ys[g.ys.length - 1]) / 2 }))
    .filter((l) => l.y <= electives[0]._y + 8 && l.y >= electives[electives.length - 1]._y - 8);
  if (!labels.length) return;
  let i = 0;
  for (const [li, label] of labels.entries()) {
    if (i >= electives.length) break;
    const top = electives[i]._y;
    const bottom = li === labels.length - 1 ? -Infinity : 2 * label.y - top - 4;
    while (i < electives.length && electives[i]._y >= bottom) {
      electives[i].category = label.name;
      i += 1;
    }
  }
}

/**
 * Dosyayı çizelgelere ayrıştırır. Dönüş: [{ title, source, levels, items, warnings }]
 * items: { sort_order, name, kind: ortak|secmeli|rehberlik, category, max_takes, hours: {seviye: [saatler]} }
 */
async function parseLessonPoolFile(buffer, filename) {
  const lower = String(filename || '').toLowerCase();
  const isPdf = lower.endsWith('.pdf') || buffer.slice(0, 4).toString() === '%PDF';
  const pages = isPdf ? await pdfPages(buffer) : excelPages(buffer);
  const out = [];
  for (const page of pages) {
    const sheet = interpretPage(page);
    if (sheet) out.push(sheet);
  }
  return out;
}

module.exports = { parseLessonPoolFile, parseHours, parseSubjectName, titleCaseTr, HAZIRLIK };
