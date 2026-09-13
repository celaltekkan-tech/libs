const fs = require('fs/promises');
const path = require('path');
const { BackupSetting } = require('../models');

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));

// Yalnızca scripts/db-backup.sh'ın ürettiği dosya adı kalıbına izin verilir
// (path traversal önlemi).
const SAFE_FILENAME = /^[A-Za-z0-9_.-]+\.sql\.gz$/;

async function getOrCreateSettings() {
  const existing = await BackupSetting.findOne({ order: [['id', 'ASC']] });
  if (existing) return existing;
  return BackupSetting.create({ retention_days: 30 });
}

module.exports = {
  async getSettings(req, res, next) {
    try {
      const settings = await getOrCreateSettings();
      res.json({ success: true, data: { retention_days: settings.retention_days } });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const { retention_days } = req.validatedBody;
      const settings = await getOrCreateSettings();
      await settings.update({ retention_days, updated_by: req.user.user_id });
      res.json({ success: true, data: { retention_days: settings.retention_days } });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      let entries;
      try {
        entries = await fs.readdir(BACKUP_DIR);
      } catch (err) {
        if (err.code === 'ENOENT') return res.json({ success: true, data: [] });
        throw err;
      }

      const files = await Promise.all(
        entries
          .filter((name) => name.endsWith('.sql.gz'))
          .map(async (name) => {
            const stat = await fs.stat(path.join(BACKUP_DIR, name));
            return { filename: name, size_bytes: stat.size, created_at: stat.mtime };
          })
      );

      files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json({ success: true, data: files });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const { filename } = req.params;
      if (!SAFE_FILENAME.test(filename)) {
        return res.status(400).json({ success: false, code: 'INVALID_FILENAME', message: 'Geçersiz dosya adı' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          return res.status(404).json({ success: false, message: 'Yedek dosyası bulunamadı' });
        }
        throw err;
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
