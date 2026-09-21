const backupService = require('../services/backupService');

module.exports = {
  async getSettings(req, res, next) {
    try {
      const settings = await backupService.getOrCreateSettings();
      res.json({ success: true, data: backupService.serializeSettings(settings) });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const data = await backupService.updateSettings(req.validatedBody, req.user.user_id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const files = await backupService.listBackupFiles();
      res.json({ success: true, data: files });
    } catch (err) {
      next(err);
    }
  },

  async run(req, res, next) {
    try {
      const data = await backupService.runBackup('manual');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async restore(req, res, next) {
    try {
      const data = await backupService.restoreBackup(req.params.filename);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await backupService.deleteBackupFile(req.params.filename);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
