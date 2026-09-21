const Joi = require('joi');

const STATUS_VALUES = ['acik', 'inceleniyor', 'karara_baglandi', 'kapandi'];
const ROLE_VALUES = ['magdur', 'suclanan', 'tanik'];
const PARTICIPANT_STATUS_VALUES = ['kayitli', 'ifade_bekleniyor', 'savunma_bekleniyor', 'karara_baglandi', 'kapandi'];

const createIncidentSchema = Joi.object({
  school_id: Joi.number().integer().required(),
  title: Joi.string().trim().required(),
  incident_date: Joi.date().iso().required(),
  incident_time: Joi.string().trim().allow('', null).max(20),
  location: Joi.string().trim().allow('', null).max(255),
  summary: Joi.string().trim().allow('', null).max(4000),
  complainant_name: Joi.string().trim().allow('', null).max(255),
  complaint_ref_date: Joi.date().iso().allow(null),
  complaint_ref_no: Joi.string().trim().allow('', null).max(120),
});

const updateIncidentSchema = Joi.object({
  title: Joi.string().trim(),
  incident_date: Joi.date().iso(),
  incident_time: Joi.string().trim().allow('', null).max(20),
  location: Joi.string().trim().allow('', null).max(255),
  summary: Joi.string().trim().allow('', null).max(4000),
  complainant_name: Joi.string().trim().allow('', null).max(255),
  complaint_ref_date: Joi.date().iso().allow(null),
  complaint_ref_no: Joi.string().trim().allow('', null).max(120),
  status: Joi.string().valid(...STATUS_VALUES),
});

const addParticipantSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  role: Joi.string()
    .valid(...ROLE_VALUES)
    .required(),
});

const updateParticipantSchema = Joi.object({
  role: Joi.string().valid(...ROLE_VALUES),
  status: Joi.string().valid(...PARTICIPANT_STATUS_VALUES),
  health_status: Joi.string().trim().allow('', null).max(1000),
  economic_status_mother: Joi.string().trim().allow('', null).max(255),
  economic_status_father: Joi.string().trim().allow('', null).max(255),
  family_together: Joi.string().trim().allow('', null).max(255),
  parents_alive: Joi.string().trim().allow('', null).max(255),
  parents_biological: Joi.string().trim().allow('', null).max(255),
  raised_environment: Joi.string().trim().allow('', null).max(1000),
  family_address: Joi.string().trim().allow('', null).max(1000),
  notes: Joi.string().trim().allow('', null).max(2000),
});

const excelCommitSchema = Joi.object({
  rows: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().required(),
        role: Joi.string()
          .valid(...ROLE_VALUES)
          .required(),
      })
    )
    .min(1)
    .required(),
});

module.exports = {
  STATUS_VALUES,
  ROLE_VALUES,
  PARTICIPANT_STATUS_VALUES,
  createIncidentSchema,
  updateIncidentSchema,
  addParticipantSchema,
  updateParticipantSchema,
  excelCommitSchema,
};
