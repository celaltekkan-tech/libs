'use strict';

const { ParentConsent, Student } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);

      const rows = await ParentConsent.findAll({
        where,
        include: [{ model: Student, attributes: ['id', 'first_name', 'last_name', 'student_number'], required: false }],
        order: [['created_at', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async upsert(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      const student = await Student.findByPk(payload.student_id);
      if (!student || (tenantId && student.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğrenci bulunamadı' });
      }

      const [row] = await ParentConsent.findOrCreate({
        where: { student_id: payload.student_id, consent_type: payload.consent_type },
        defaults: {
          tenant_id: tenantId,
          student_id: payload.student_id,
          consent_type: payload.consent_type,
          granted: payload.granted,
          granted_at: payload.granted ? new Date() : null,
          notes: payload.notes || null,
        },
      });
      await row.update({
        granted: payload.granted,
        granted_at: payload.granted ? row.granted_at || new Date() : null,
        notes: payload.notes ?? row.notes,
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'parent_consent',
        entityId: row.id,
        summary: `KVKK rıza kaydı güncellendi: ${student.first_name} ${student.last_name} - ${payload.consent_type} (${payload.granted ? 'onaylı' : 'onaysız'})`,
      });

      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },
};
