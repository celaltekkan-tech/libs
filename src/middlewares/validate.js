module.exports = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Gönderilen bilgiler geçersiz',
        errors: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    req.validatedBody = value;
    return next();
  };
};
