'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/extensionController');

router.get('/version', ctrl.version);
router.get('/updates.xml', ctrl.updatesXml);
router.get('/oids-eokul-eklentisi.zip', ctrl.downloadZip);
router.get('/package.crx', ctrl.downloadCrx);

module.exports = router;
