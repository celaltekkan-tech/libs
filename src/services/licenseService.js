const { License } = require('../models');
const { Op } = require('sequelize');

/**
 * Bir tenant'ın şu anda geçerli (aktif ve süresi dolmamış) lisansını döner.
 * Yoksa null döner — tenant lisanssız/süresi dolmuş kabul edilir.
 */
async function getActiveLicense(tenantId) {
  return License.findOne({
    where: {
      tenant_id: tenantId,
      status: 'active',
      [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: new Date() } }],
    },
    order: [['created_at', 'DESC']],
  });
}

module.exports = { getActiveLicense };
