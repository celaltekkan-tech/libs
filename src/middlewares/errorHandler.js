const isProduction = () => process.env.NODE_ENV === 'production';

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error(`[${req.method} ${req.originalUrl}]`, err);

  if (err.message && err.message.startsWith('CORS engellendi')) {
    return res.status(403).json({
      success: false,
      code: 'CORS_BLOCKED',
      message: 'Bu adresten gelen isteklere izin verilmiyor',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      message: 'Gönderilen veri geçerli bir JSON değil',
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_RECORD',
      message: 'Bu kayıt zaten mevcut',
      errors: err.errors ? err.errors.map((e) => e.message) : undefined,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Gönderilen veri geçersiz',
      errors: err.errors ? err.errors.map((e) => e.message) : undefined,
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      code: 'RELATED_RECORD_MISSING',
      message: 'İlişkili kayıt bulunamadı veya bu kayıt başka kayıtlarca kullanılıyor',
    });
  }

  const status = err.status || 500;

  return res.status(status).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: status === 500 && isProduction() ? 'Sunucu hatası' : err.message || 'Sunucu hatası',
    ...(isProduction() ? {} : { stack: err.stack }),
  });
};
