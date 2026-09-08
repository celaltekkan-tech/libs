const { Teacher } = require('../models');
module.exports = {
    async list(req, res, next) {
    try {
    const tenantId = req.user && req.user.tenant_id;
    const where = {};
    if (tenantId) where.tenant_id = tenantId;
    // Filtreleme için query paramlarını kullanabilirsiniz
    const teachers = await Teacher.findAll({ where, limit: 100 });
    res.json({ success: true, data: teachers });
    } catch (err) {
    next(err);
    }
    },
async get(req, res, next) {
try {
const id = req.params.id;
const teacher = await Teacher.findByPk(id);
if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
// tenant kontrolü
if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
res.json({ success: true, data: teacher });
} catch (err) { next(err); }
},


async create(req, res, next) {
try {
const payload = req.validatedBody || req.body;
// tenant_id kaydı zorunluysa auth kullanılarak doğrula
if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
const teacher = await Teacher.create(payload);
res.status(201).json({ success: true, data: teacher });
} catch (err) { next(err); }
},


async update(req, res, next) {
try {
const id = req.params.id;
const teacher = await Teacher.findByPk(id);
if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
const payload = req.validatedBody || req.body;
await teacher.update(payload);
res.json({ success: true, data: teacher });
} catch (err) { next(err); }
},


async remove(req, res, next) {
try {
const id = req.params.id;
const teacher = await Teacher.findByPk(id);
if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
await teacher.destroy();
res.json({ success: true });
} catch (err) { next(err); }
}
};