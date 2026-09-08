const Joi = require('joi');


const createTeacherSchema = Joi.object({
tenant_id: Joi.number().integer().required(),
school_id: Joi.number().integer().allow(null),
city: Joi.string().allow('', null),
district: Joi.string().allow('', null),
personnel_no: Joi.string().allow('', null),
national_id: Joi.string().allow('', null),
first_name: Joi.string().required(),
last_name: Joi.string().required(),
last_graduated_school: Joi.string().allow('', null),
class_level: Joi.string().allow('', null),
title_branch: Joi.string().allow('', null),
working_institution: Joi.string().allow('', null),
degree: Joi.string().allow('', null),
pension_degree: Joi.string().allow('', null),
rank: Joi.string().allow('', null),
degree_rank_date: Joi.date().allow(null),
school_principal: Joi.string().allow('', null),
meta: Joi.object().optional()
});


module.exports = { createTeacherSchema };