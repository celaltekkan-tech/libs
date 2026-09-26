'use strict';

/** Lise listeleri 9-10-11-12 diye gider; 1-8. sınıflar bunların ardından gelir. */
function gradeOrder(level) {
  const n = Number.parseInt(String(level ?? '').trim(), 10);
  if (!Number.isFinite(n)) return 2000;
  if (n >= 9) return n;
  return 1000 + n;
}

function compareClassrooms(a, b) {
  const g = gradeOrder(a && a.class_level) - gradeOrder(b && b.class_level);
  if (g) return g;
  return String((a && a.section) || '').localeCompare(String((b && b.section) || ''), 'tr');
}

function sortClassrooms(rows) {
  return [...rows].sort(compareClassrooms);
}

module.exports = { gradeOrder, compareClassrooms, sortClassrooms };
