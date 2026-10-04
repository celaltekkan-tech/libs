'use strict';

const Joi = require('joi');
const { SCHOOL_CODE_PATTERN, SCHOOL_CODE_MESSAGE } = require('../utils/schoolCode');

const optionalCode = Joi.string()
  .trim()
  .pattern(SCHOOL_CODE_PATTERN)
  .allow('', null)
  .empty('')
  .messages({
    'string.pattern.base': SCHOOL_CODE_MESSAGE,
  });

const optionalWebsite = Joi.string().trim().max(300).allow('', null).empty('');

const createDirectorySchoolSchema = Joi.object({
  name: Joi.string().trim().min(2).max(250).required().messages({
    'string.empty': 'Okul adı zorunludur',
    'string.min': 'Okul adı en az 2 karakter olmalı',
  }),
  province_id: Joi.number().integer().required().messages({
    'any.required': 'İl zorunludur',
  }),
  district_id: Joi.number().integer().allow(null).empty(''),
  school_type: Joi.string().valid('ortaokul', 'lise').required().messages({
    'any.only': 'Kademe ortaokul veya lise olmalı',
    'any.required': 'Kademe zorunludur',
  }),
  code: optionalCode,
  website: optionalWebsite,
});

const updateDirectorySchoolSchema = Joi.object({
  name: Joi.string().trim().min(2).max(250).messages({
    'string.empty': 'Okul adı zorunludur',
    'string.min': 'Okul adı en az 2 karakter olmalı',
  }),
  province_id: Joi.number().integer(),
  district_id: Joi.number().integer().allow(null).empty(''),
  school_type: Joi.string().valid('ortaokul', 'lise').messages({
    'any.only': 'Kademe ortaokul veya lise olmalı',
  }),
  code: optionalCode,
  website: optionalWebsite,
}).min(1);

module.exports = {
  createDirectorySchoolSchema,
  updateDirectorySchoolSchema,
};
