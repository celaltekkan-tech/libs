const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplineRegulationArticlesController');
const validate = require('../middlewares/validate');
const { createRegulationArticleSchema } = require('../validators/disciplineRegulationArticle.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('discipline.update'), validate(createRegulationArticleSchema), ctrl.create);
router.delete('/:id', auth, moduleGuard, permission('discipline.update'), ctrl.remove);

module.exports = router;
