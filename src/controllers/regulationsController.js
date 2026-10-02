'use strict';

const path = require('path');

const REGULATIONS = {
  'ortaogretim-kurumlari-yonetmeligi': {
    file: path.join(__dirname, '..', 'assets', 'regulations', 'ortaogretim-kurumlari-yonetmeligi.pdf'),
    filename: 'MEB-Ortaogretim-Kurumlari-Yonetmeligi.pdf',
    mime: 'application/pdf',
  },
  'ek-ders-yonetmeligi': {
    file: path.join(__dirname, '..', 'assets', 'regulations', 'ek-ders-yonetmeligi.pdf'),
    filename: 'Ek-Ders-Yonetmeligi.pdf',
    mime: 'application/pdf',
  },
  'ayakta-tedavi-beyan-belgesi': {
    file: path.join(__dirname, '..', 'assets', 'petitions', 'ayakta-tedavi-beyan-belgesi.docx'),
    filename: 'Ayakta-Tedavi-Beyan-Belgesi.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};

module.exports = {
  async download(req, res, next) {
    try {
      const reg = REGULATIONS[req.params.slug];
      if (!reg) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      res.setHeader('Content-Type', reg.mime || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(reg.filename)}`);
      return res.sendFile(reg.file, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  },
};
