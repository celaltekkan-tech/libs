'use strict';

const path = require('path');

const REGULATIONS = {
  'ortaogretim-kurumlari-yonetmeligi': {
    file: path.join(__dirname, '..', 'assets', 'regulations', 'ortaogretim-kurumlari-yonetmeligi.pdf'),
    filename: 'MEB-Ortaogretim-Kurumlari-Yonetmeligi.pdf',
  },
};

module.exports = {
  async download(req, res, next) {
    try {
      const reg = REGULATIONS[req.params.slug];
      if (!reg) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(reg.filename)}`);
      return res.sendFile(reg.file, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  },
};
