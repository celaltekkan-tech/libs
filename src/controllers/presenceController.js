const presence = require('../services/presenceService');

module.exports = {
  async heartbeat(req, res, next) {
    try {
      await presence.touch(req.user?.user_id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async summary(req, res, next) {
    try {
      const data = await presence.summary();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
