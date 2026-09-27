'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const { pipeline } = require('stream/promises');

const MAGIC = Buffer.from('LBSENC01');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN;

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32);
}

/**
 * gzip yedeği AES-256-GCM ile şifreler.
 * Biçim: LBSENC01 | salt(16) | iv(12) | ciphertext | tag(16)
 */
async function encryptFile(srcPath, destPath, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const out = fs.createWriteStream(destPath);
  try {
    await new Promise((resolve, reject) => {
      out.write(Buffer.concat([MAGIC, salt, iv]), (err) => (err ? reject(err) : resolve()));
    });
    await pipeline(fs.createReadStream(srcPath), cipher, out);
    await fsp.appendFile(destPath, cipher.getAuthTag());
    return (await fsp.stat(destPath)).size;
  } catch (err) {
    await fsp.unlink(destPath).catch(() => {});
    throw err;
  }
}

async function decryptFile(srcPath, destPath, password) {
  const stat = await fsp.stat(srcPath);
  if (stat.size < HEADER_LEN + TAG_LEN + 1) {
    throw new Error('Şifreli yedek çok kısa veya bozuk');
  }
  const header = Buffer.alloc(HEADER_LEN);
  const tag = Buffer.alloc(TAG_LEN);
  const fh = await fsp.open(srcPath, 'r');
  try {
    const headRead = await fh.read(header, 0, HEADER_LEN, 0);
    const tagRead = await fh.read(tag, 0, TAG_LEN, stat.size - TAG_LEN);
    if (headRead.bytesRead !== HEADER_LEN || tagRead.bytesRead !== TAG_LEN) {
      throw new Error('Şifreli yedek okunamadı');
    }
  } finally {
    await fh.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Şifreli yedek biçimi tanınmadı');
  }
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = header.subarray(MAGIC.length + SALT_LEN, HEADER_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(password, salt), iv);
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      fs.createReadStream(srcPath, { start: HEADER_LEN, end: stat.size - TAG_LEN - 1 }),
      decipher,
      fs.createWriteStream(destPath)
    );
  } catch (err) {
    await fsp.unlink(destPath).catch(() => {});
    if (/authenticate|unsupported state/i.test(err.message)) {
      throw new Error('Şifre yanlış veya dosya bozulmuş');
    }
    throw err;
  }
}

module.exports = {
  encryptFile,
  decryptFile,
};
