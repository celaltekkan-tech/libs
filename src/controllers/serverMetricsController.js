const { collectServerMetrics } = require('../services/serverMetricsService');

module.exports = {
  async get(req, res, next) {
    try {
      const data = await collectServerMetrics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
