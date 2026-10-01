'use strict';

function upperPersonName(value) {
  if (value == null) return value;
  const text = String(value).trim();
  if (!text) return text;
  return text.toLocaleUpperCase('tr-TR');
}

module.exports = { upperPersonName };
