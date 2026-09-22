'use strict';

const { readSheetMatrix, cellToDisplay } = require('./excelImportService');

const CLASS_HEADER_RE =
  /(\d{1,2})\s*\.\s*S[ıiIİ]n[ıiIİ]f\s*\/\s*([A-ZÇĞİÖŞÜa-zçğıöşü])/i;
const GRADE_RE = /^(5|6|7|8|9|10|11|12)$/;
const STUDENT_NO_RE = /^\d{1,10}$/;
const NAME_RE = /[A-Za-zÇĞİÖŞÜçğıöşü]/;

const SUBJECT_ALIASES = {
  'yabancı dil': ['ingilizce'],
  'ikinci yabancı dil': ['almanca', 'fransızca', 'fransizca', 'arapça', 'arapca'],
  'türk dili ve edebiyatı': ['edebiyat', 'türkçe'],
  'din kültürü ve ahlâk bilgisi': ['din kültürü ve ahlak bilgisi', 'din kültürü'],
  'sağlık bilgisi ve trafik kültürü': ['sağlık bilgisi'],
};

function compactCells(row) {
  return (row || [])
    .map((c) => cellToDisplay(c))
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());
}

function isGrade(value) {
  return GRADE_RE.test(String(value || '').trim());
}

function normalizeStudentNumber(value) {
  const raw = String(value || '').trim();
  if (!STUDENT_NO_RE.test(raw)) return null;
  return String(Number(raw));
}

function normalizeSubjectLabel(value) {
  return String(value || '')
    .trim()
    .replace(/[`´''']/g, "'")
    .replace(/\s+/g, ' ');
}

function nameKey(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function subjectNameKey(value) {
  return nameKey(normalizeSubjectLabel(value));
}

function studentFullName(student) {
  return `${student.first_name || ''} ${student.last_name || ''}`.replace(/\s+/g, ' ').trim();
}

function subjectCandidateKeys(rawName) {
  const label = normalizeSubjectLabel(rawName);
  const key = subjectNameKey(label);
  const keys = new Set([key]);
  const stripped = key.replace(/^seçmeli\s+/, '');
  if (stripped && stripped !== key) keys.add(stripped);
  if (key.includes('/')) {
    key.split('/').forEach((part) => {
      const p = part.trim();
      if (p) keys.add(p);
    });
  }
  const aliases = SUBJECT_ALIASES[key] || SUBJECT_ALIASES[stripped] || [];
  aliases.forEach((alias) => keys.add(subjectNameKey(alias)));
  return [...keys];
}

function matchSubjectId(rawName, subjectsByKey) {
  const candidates = subjectCandidateKeys(rawName);
  const hits = new Map();
  for (const key of candidates) {
    const list = subjectsByKey.get(key) || [];
    for (const sub of list) {
      if (!hits.has(sub.id)) hits.set(sub.id, sub);
    }
  }
  if (hits.size === 1) return [...hits.values()][0];
  if (hits.size > 1) {
    const exact = subjectNameKey(normalizeSubjectLabel(rawName));
    const exactList = (subjectsByKey.get(exact) || []).filter((s) => hits.has(s.id));
    if (exactList.length === 1) return exactList[0];
  }
  return null;
}

function parseClassHeader(text) {
  const m = String(text || '').match(CLASS_HEADER_RE);
  if (!m) return null;
  return {
    current_class_level: String(Number(m[1])),
    current_section: m[2].toLocaleUpperCase('tr-TR'),
    source_text: String(text).trim(),
  };
}

function isMetaRow(cells) {
  const joined = cells.join(' ');
  if (!joined) return true;
  if (/öğrencilerin\s+sorumlu\s+olduğu/i.test(joined)) return true;
  if (/öğrenciye\s+ait\s+toplam/i.test(joined)) return true;
  if (/öğrenci\s*no/i.test(joined) && /dersi/i.test(joined)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cells[0] || '')) return true;
  return false;
}

function parseStudentRow(cells) {
  if (cells.length < 5) return null;
  const student_number = normalizeStudentNumber(cells[1]);
  const student_name = cells[2];
  const subject_class_level = isGrade(cells[3]) ? String(cells[3]) : null;
  const subject_name = normalizeSubjectLabel(cells[4]);
  if (!student_number || !NAME_RE.test(student_name) || !subject_class_level || !subject_name) {
    return null;
  }
  if (isGrade(subject_name)) return null;
  return { student_number, student_name: student_name.replace(/\s+/g, ' ').trim(), subject_class_level, subject_name };
}

function parseContinuationRow(cells) {
  if (cells.length !== 2) return null;
  if (!isGrade(cells[0])) return null;
  const subject_name = normalizeSubjectLabel(cells[1]);
  if (!subject_name || isGrade(subject_name) || !NAME_RE.test(subject_name)) return null;
  return { subject_class_level: String(cells[0]), subject_name };
}

function parseSorumlulukWorkbook(buffer) {
  const { matrix } = readSheetMatrix(buffer);
  let title = null;
  let currentClass = { current_class_level: null, current_section: null };
  let currentStudent = null;
  const rows = [];

  for (let i = 0; i < matrix.length; i += 1) {
    const cells = compactCells(matrix[i]);
    if (cells.length === 0) continue;

    const joined = cells.join(' ');
    if (!title && /sorumlu\s+olduğu\s+ders/i.test(joined)) {
      title = joined.replace(/\s+/g, ' ').trim();
    }
    if (isMetaRow(cells)) continue;

    const header = parseClassHeader(joined);
    if (header) {
      currentClass = header;
      currentStudent = null;
      continue;
    }

    const studentRow = parseStudentRow(cells);
    if (studentRow) {
      currentStudent = {
        student_number: studentRow.student_number,
        student_name: studentRow.student_name,
      };
      rows.push({
        row_index: i,
        ...currentStudent,
        current_class_level: currentClass.current_class_level,
        current_section: currentClass.current_section,
        subject_class_level: studentRow.subject_class_level,
        subject_name: studentRow.subject_name,
      });
      continue;
    }

    const cont = parseContinuationRow(cells);
    if (cont && currentStudent) {
      rows.push({
        row_index: i,
        student_number: currentStudent.student_number,
        student_name: currentStudent.student_name,
        current_class_level: currentClass.current_class_level,
        current_section: currentClass.current_section,
        subject_class_level: cont.subject_class_level,
        subject_name: cont.subject_name,
      });
    }
  }

  return { title, rows };
}

function attachMatches(rows, { students, subjects, classrooms }) {
  const byNumber = new Map();
  const byName = new Map();
  for (const student of students || []) {
    const num = normalizeStudentNumber(student.student_number);
    if (num) byNumber.set(num, student);
    const key = nameKey(studentFullName(student));
    if (!key) continue;
    const list = byName.get(key) || [];
    list.push(student);
    byName.set(key, list);
  }

  const subjectsByKey = new Map();
  for (const subject of subjects || []) {
    const key = subjectNameKey(subject.name);
    const list = subjectsByKey.get(key) || [];
    list.push(subject);
    subjectsByKey.set(key, list);
  }

  const classroomByKey = new Map();
  for (const room of classrooms || []) {
    const key = `${String(room.class_level || '').trim()}|${String(room.section || '')
      .trim()
      .toLocaleUpperCase('tr-TR')}`;
    classroomByKey.set(key, room);
  }

  return rows.map((row) => {
    let student = byNumber.get(normalizeStudentNumber(row.student_number));
    let student_match = student ? 'number' : null;
    if (!student) {
      const named = byName.get(nameKey(row.student_name)) || [];
      if (named.length === 1) {
        student = named[0];
        student_match = 'name';
      }
    }

    const subject = matchSubjectId(row.subject_name, subjectsByKey);
    let classroom_id = student ? student.classroom_id || null : null;
    let school_id = student ? student.school_id || null : null;
    if (!classroom_id && row.current_class_level && row.current_section) {
      const room = classroomByKey.get(
        `${row.current_class_level}|${String(row.current_section).toLocaleUpperCase('tr-TR')}`,
      );
      if (room) {
        classroom_id = room.id;
        if (!school_id) school_id = room.school_id || null;
      }
    }

    const name_mismatch = !!(
      student &&
      student_match === 'number' &&
      nameKey(studentFullName(student)) &&
      nameKey(row.student_name) &&
      nameKey(studentFullName(student)) !== nameKey(row.student_name)
    );

    return {
      ...row,
      student_id: student ? student.id : null,
      classroom_id,
      school_id,
      subject_id: subject ? subject.id : null,
      student_matched: !!student,
      subject_matched: !!subject,
      student_match,
      name_mismatch,
      matched_student_name: student ? studentFullName(student) : null,
      matched_subject_name: subject ? subject.name : null,
    };
  });
}

function summarizePreview(rows) {
  const studentNos = new Set(rows.map((r) => r.student_number));
  const unmatchedStudentNos = new Set(
    rows.filter((r) => !r.student_matched).map((r) => r.student_number),
  );
  const unmatchedSubjects = new Set(
    rows.filter((r) => !r.subject_matched).map((r) => `${r.subject_class_level}|${r.subject_name}`),
  );
  const subjects = new Set(rows.map((r) => `${r.subject_class_level}|${r.subject_name}`));
  const unmatched_subject_names = unmatchedSubjectNames(rows);
  return {
    student_count: studentNos.size,
    row_count: rows.length,
    subject_count: subjects.size,
    unmatched_students: unmatchedStudentNos.size,
    unmatched_subjects: unmatchedSubjects.size,
    unmatched_subject_names,
  };
}

function unmatchedSubjectNames(rows) {
  const names = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (row.subject_id || row.subject_matched) continue;
    const name = normalizeSubjectLabel(row.subject_name);
    if (!name) continue;
    const key = subjectNameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function applySubjectMatches(rows, subjects) {
  const subjectsByKey = new Map();
  for (const subject of subjects || []) {
    const key = subjectNameKey(subject.name);
    const list = subjectsByKey.get(key) || [];
    list.push(subject);
    subjectsByKey.set(key, list);
  }
  return (rows || []).map((row) => {
    if (row.subject_id) {
      return { ...row, subject_matched: true };
    }
    const subject = matchSubjectId(row.subject_name, subjectsByKey);
    return {
      ...row,
      subject_id: subject ? subject.id : null,
      subject_matched: !!subject,
      matched_subject_name: subject ? subject.name : row.matched_subject_name || null,
    };
  });
}

function itemDedupeKey(row) {
  return [
    normalizeStudentNumber(row.student_number) || row.student_number,
    String(row.subject_class_level || ''),
    subjectNameKey(normalizeSubjectLabel(row.subject_name)),
  ].join('|');
}

module.exports = {
  parseSorumlulukWorkbook,
  attachMatches,
  applySubjectMatches,
  summarizePreview,
  unmatchedSubjectNames,
  itemDedupeKey,
  normalizeStudentNumber,
  normalizeSubjectLabel,
};
