'use strict';

/** İsteği geri bildirim veya teknik destek kaydı olarak işaretler. */
module.exports = function ticketKind(kind) {
  return (req, _res, next) => {
    req.ticketKind = kind === 'support' ? 'support' : 'feedback';
    next();
  };
};
