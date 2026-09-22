'use strict';

const CFB = require('cfb');
const { cellToDisplay, readSheetMatrix } = require('./excelImportService');

const STUDENT_NUMBER_LABEL = /öğrenci\s*numaras/i;

const LABEL_PATTERNS = [
  [STUDENT_NUMBER_LABEL, 'student_number'],
  [/t\.?\s*c\.?\s*kimlik/i, 'national_id'],
  [/ad[ıi]\s*soyad[ıi]/i, 'full_name'],
  [/baba\s*ad[ıi]/i, 'father_name'],
  [/anne\s*ad[ıi]/i, 'mother_name'],
  [/ana\s*ad[ıi]/i, 'mother_name'],
  [/cinsiyet/i, 'gender'],
  [/doğum\s*tarihi/i, 'birth_date'],
];

const OLE_SIGNATURE = 0xd0cf11e0;
const REC_MSODRAWINGGROUP = 0x00eb;
const REC_MSODRAWING = 0x00ec;
const REC_CONTINUE = 0x003c;
const ESCHER_FBSE = 0xf007;
const ESCHER_OPT = 0xf00b;
const ESCHER_CLIENT_ANCHOR = 0xf010;
const ESCHER_PROP_PIB = 0x4104;
const BLIP_TYPE_JPEG = 5;

function findValueAfter(row, labelIdx) {
  const limit = Math.min(row.length, labelIdx + 6);
  for (let i = labelIdx + 1; i < limit; i += 1) {
    const v = cellToDisplay(row[i]);
    if (v != null) return v;
  }
  return null;
}

/**
 * Etiketin, birden çok sütun başlığının yan yana bulunduğu bir TABLO başlık satırında
 * değil, "etiket: değer" biçimindeki tek bir form satırında geçtiğini doğrular — aksi
 * halde birden çok sınıf sayfası art arda basılan normal sınıf listelerinde (her sayfa
 * başında tekrar eden sütun başlıkları) yanlışlıkla fotoğraflı döküm sanılabilir.
 */
function countLabelFormRows(matrix, pattern) {
  let count = 0;
  for (const row of matrix) {
    const nonEmpty = (row || []).filter((cell) => cellToDisplay(cell) != null);
    if (nonEmpty.length > 3) continue;
    const matches = nonEmpty.some((cell) => pattern.test(cellToDisplay(cell)));
    if (matches) count += 1;
  }
  return count;
}

/** E-Okul "Fotoğraflı Öğrenci Bilgileri" dökümünü, her öğrencinin tek bir sütun
 * başlığı yerine tekrar eden bir "Öğrenci Numarası...:" etiketiyle açılan dikey
 * bloklar halinde bastığı için, sınıf listesi Excel'lerinden ayırt eder. */
function isPhotoRosterWorkbook(buffer) {
  const { matrix } = readSheetMatrix(buffer);
  return countLabelFormRows(matrix, STUDENT_NUMBER_LABEL) >= 2;
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  const last_name = parts.pop();
  const first_name = parts.join(' ') || last_name;
  return { first_name, last_name };
}

function readLogicalBiffRecords(content) {
  const records = [];
  let pos = 0;
  while (pos + 4 <= content.length) {
    const type = content.readUInt16LE(pos);
    const len = content.readUInt16LE(pos + 2);
    const data = content.slice(pos + 4, pos + 4 + len);
    pos += 4 + len;
    if (type === REC_CONTINUE && records.length > 0) {
      records[records.length - 1].data = Buffer.concat([records[records.length - 1].data, data]);
    } else {
      records.push({ type, data });
    }
  }
  return records;
}

function walkEscherRecords(data, offset, end, onRecord) {
  let p = offset;
  while (p + 8 <= end) {
    const verInstance = data.readUInt16LE(p);
    const recType = data.readUInt16LE(p + 2);
    const recLen = data.readUInt32LE(p + 4);
    const isContainer = (verInstance & 0x0f) === 0x0f;
    const headerEnd = p + 8;
    const recEnd = Math.min(end, headerEnd + recLen);
    onRecord({ recType, headerEnd, recEnd });
    if (isContainer) walkEscherRecords(data, headerEnd, recEnd, onRecord);
    p += 8 + recLen;
  }
}

/**
 * Bir MSODRAWING kaydındaki tek şeklin hangi satıra (row1) ait olduğunu (ClientAnchor)
 * ve hangi BLIP'i kullandığını (OPT özellik tablosundaki "pib" — 0x4104) yapıyı gerçekten
 * yürüyerek okur. Baytları hizasız (byte-by-byte) tarayan bir yaklaşım, komşu bir özelliğin
 * değerinde rastlantısal olarak aynı iki baytın geçmesi yüzünden yanlış pib/satır okuyup
 * fotoğrafları farklı öğrencilere kaydırabilirdi.
 */
function findRow1AndPib(data) {
  let row1 = null;
  let pib = null;
  walkEscherRecords(data, 0, data.length, (info) => {
    if (info.recType === ESCHER_CLIENT_ANCHOR) {
      if (info.recEnd - info.headerEnd >= 18) {
        row1 = data.readUInt16LE(info.headerEnd + 6);
      }
    } else if (info.recType === ESCHER_OPT) {
      for (let p = info.headerEnd; p + 6 <= info.recEnd; p += 6) {
        if (data.readUInt16LE(p) === ESCHER_PROP_PIB) {
          pib = data.readUInt32LE(p + 2);
        }
      }
    }
  });
  return { row1, pib };
}

/** [start, end) aralığında ilk JPEG'i (SOI..EOI) arar; arama her BLIP kaydının
 * kendi Escher uzunluğuyla sınırlandığından, komşu bir kaydın (ör. fotoğrafsız
 * öğrenciler için kullanılan DIB yer tutucunun ham piksel baytları) rastlantısal
 * olarak JPEG imzasına benzemesi başka bir öğrencinin resmini bozamaz. */
function findJpegInRange(buffer, start, end) {
  for (let pos = start; pos + 3 <= end; pos += 1) {
    if (buffer[pos] === 0xff && buffer[pos + 1] === 0xd8 && buffer[pos + 2] === 0xff) {
      for (let i = pos + 2; i + 2 <= end; i += 1) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) {
          return buffer.slice(pos, i + 2);
        }
      }
      return null;
    }
  }
  return null;
}

/**
 * Eski (.xls / BIFF8) dosyalarda gömülü resimleri SheetJS okuyamadığından, satır
 * bazlı fotoğrafları doğrudan Escher yapısından çıkarır: MSODRAWINGGROUP kaydındaki
 * BLIP deposunun sırası (pib) her resmin JPEG mi yoksa (fotoğrafsız öğrenciler için
 * kullanılan) bir yer tutucu mu olduğunu, her satırın MSODRAWING/ClientAnchor kaydı
 * ise o resmin hangi satıra (row1) ait olduğunu verir — yalnızca resim sırasına göre
 * eşleştirmek, aradaki fotoğrafsız öğrencilerde tüm sonraki eşleşmeleri kaydırırdı.
 */
function extractRowPhotoMap(buffer) {
  const map = new Map();
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== OLE_SIGNATURE) return map;

  let cfb;
  try {
    cfb = CFB.read(buffer, { type: 'buffer' });
  } catch {
    return map;
  }
  let wbContent = null;
  for (let i = 0; i < cfb.FileIndex.length; i += 1) {
    if (/\/(Workbook|Book)$/i.test(cfb.FullPaths[i])) {
      const content = cfb.FileIndex[i].content;
      wbContent = Buffer.isBuffer(content) ? content : Buffer.from(content);
      break;
    }
  }
  if (!wbContent) return map;

  const records = readLogicalBiffRecords(wbContent);
  const groupData = Buffer.concat(records.filter((r) => r.type === REC_MSODRAWINGGROUP).map((r) => r.data));
  if (!groupData.length) return map;

  const pibToImage = new Map();
  let pib = 0;
  walkEscherRecords(groupData, 0, groupData.length, (info) => {
    if (info.recType !== ESCHER_FBSE) return;
    pib += 1;
    const btWin32 = groupData.readUInt8(info.headerEnd);
    if (btWin32 !== BLIP_TYPE_JPEG) return;
    const image = findJpegInRange(groupData, info.headerEnd, info.recEnd);
    if (image) pibToImage.set(pib, image);
  });

  records
    .filter((r) => r.type === REC_MSODRAWING)
    .forEach((r) => {
      const { row1, pib } = findRow1AndPib(r.data);
      if (row1 == null || pib == null) return;
      const image = pibToImage.get(pib);
      if (image) map.set(row1, image);
    });

  return map;
}

/**
 * @returns {{ sheetName: string, students: Array<{ rowNumber: number, student_number: string|null,
 *   national_id: string|null, full_name: string|null, first_name: string|null, last_name: string|null,
 *   mother_name: string|null, father_name: string|null, gender: string|null, birth_date: string|null,
 *   photo: Buffer|null }> }}
 */
function parsePhotoRoster(buffer) {
  const { sheetName, matrix } = readSheetMatrix(buffer);

  const blockStarts = [];
  matrix.forEach((row, i) => {
    for (const cell of row || []) {
      const label = cellToDisplay(cell);
      if (label && STUDENT_NUMBER_LABEL.test(label)) {
        blockStarts.push(i);
        break;
      }
    }
  });

  const photoByRow = extractRowPhotoMap(buffer);

  const students = blockStarts.map((start, idx) => {
    const end = idx + 1 < blockStarts.length ? blockStarts[idx + 1] : matrix.length;
    const rec = {};
    for (let r = start; r < end; r += 1) {
      const row = matrix[r] || [];
      for (let c = 0; c < row.length; c += 1) {
        const label = cellToDisplay(row[c]);
        if (!label) continue;
        for (const [pattern, key] of LABEL_PATTERNS) {
          if (pattern.test(label) && rec[key] === undefined) {
            rec[key] = findValueAfter(row, c);
            break;
          }
        }
      }
    }
    const { first_name, last_name } = splitFullName(rec.full_name);
    return {
      rowNumber: start + 1,
      student_number: rec.student_number || null,
      national_id: rec.national_id || null,
      full_name: rec.full_name || null,
      first_name,
      last_name,
      mother_name: rec.mother_name || null,
      father_name: rec.father_name || null,
      gender: rec.gender || null,
      birth_date: rec.birth_date || null,
      photo: photoByRow.get(start) || null,
    };
  });

  return { sheetName, students };
}

module.exports = {
  isPhotoRosterWorkbook,
  parsePhotoRoster,
};
