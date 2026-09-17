'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/calendarController');

// Kaynak bazlı izin provider içinde kontrol edilir; ortak calendar.read yok.
router.get('/sources', auth, ctrl.sources);
router.get('/events', auth, ctrl.events);

module.exports = router;
