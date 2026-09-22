'use strict';

/**
 * Soyad/ad eşleşmesi: Türkçe I/İ/ı/i, aksanlı harfler, boşluk ve noktalama.
 * "ÖZTÜRK", "öztürk", "Ozturk", "Öztürk " aynı kabul edilir.
 */
function foldTurkishName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function turkishNamesEqual(a, b) {
  const left = foldTurkishName(a);
  const right = foldTurkishName(b);
  return Boolean(left) && left === right;
}

module.exports = { foldTurkishName, turkishNamesEqual };
