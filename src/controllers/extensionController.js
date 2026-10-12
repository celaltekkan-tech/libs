'use strict';

const {
  buildExtensionZip,
  buildUpdateXml,
  getExtensionInfo,
  readCrx,
} = require('../services/extensionPackage');

function sendError(res, next, err) {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  return next(err);
}

module.exports = {
  version(req, res, next) {
    try {
      res.json({ success: true, data: getExtensionInfo(req) });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  updatesXml(req, res, next) {
    try {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(buildUpdateXml(req));
    } catch (err) {
      sendError(res, next, err);
    }
  },

  downloadZip(_req, res, next) {
    try {
      const zip = buildExtensionZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="oids-eokul-eklentisi.zip"');
      res.send(zip);
    } catch (err) {
      sendError(res, next, err);
    }
  },

  downloadCrx(_req, res, next) {
    try {
      const crx = readCrx();
      res.setHeader('Content-Type', 'application/x-chrome-extension');
      res.setHeader('Content-Disposition', 'attachment; filename="oids-eokul.crx"');
      res.send(crx);
    } catch (err) {
      sendError(res, next, err);
    }
  },
};
