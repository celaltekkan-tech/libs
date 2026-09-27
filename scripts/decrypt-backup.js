'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { decryptFile } = require('../src/services/backupCrypto');

async function main() {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('Kullanım: node scripts/decrypt-backup.js <dosya.sql.gz.enc> <dosya.sql.gz>');
    process.exit(1);
  }
  const password = process.env.BACKUP_ENCRYPTION_PASSWORD;
  if (!password) {
    console.error('BACKUP_ENCRYPTION_PASSWORD .env içinde yok.');
    process.exit(1);
  }
  await decryptFile(path.resolve(src), path.resolve(dest), password);
  console.log(`Çözüldü: ${path.resolve(dest)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
