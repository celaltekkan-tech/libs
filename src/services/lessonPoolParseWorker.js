'use strict';

// Ayrı süreçte PDF/Excel ayrıştırma. Ana API süreci bozuk dosya veya native
// modül çökmesinden etkilenmesin diye lessonPoolParseRunner tarafından fork edilir.

const { parseLessonPoolFile } = require('./lessonPoolParser');

process.once('message', async (msg) => {
  try {
    const sheets = await parseLessonPoolFile(Buffer.from(msg.data, 'base64'), msg.filename);
    process.send({ ok: true, sheets }, () => process.exit(0));
  } catch (err) {
    process.send({ ok: false, error: err && err.message ? err.message : String(err) }, () => process.exit(0));
  }
});
