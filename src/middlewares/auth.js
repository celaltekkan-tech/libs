const jwtUtil = require('../utils/jwt');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_MISSING',
      message: 'Oturum bilgisi bulunamadı, lütfen giriş yapın',
    });
  }

  try {
    const payload = jwtUtil.verify(token);
    if (payload.purpose === '2fa_pending') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'İki adımlı doğrulama tamamlanmadan oturum açılamaz',
      });
    }
    req.user = payload;
    return next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: expired
        ? 'Oturum süresi doldu, lütfen tekrar giriş yapın'
        : 'Geçersiz oturum bilgisi',
    });
  }
};
