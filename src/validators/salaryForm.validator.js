const Joi = require('joi');

const rowPerson = {
  personnel_no: Joi.string().allow('', null).max(50),
  full_name: Joi.string().allow('', null).max(150),
  national_id: Joi.string().allow('', null).max(20),
  documents: Joi.string().allow('', null).max(500),
};

const salaryFormPayloadSchema = Joi.object({
  institution_name: Joi.string().allow('', null).max(200),
  bank_branch: Joi.string().allow('', null).max(200),
  accounting_code: Joi.string().allow('', null).max(100),
  principal: Joi.string().allow('', null).max(150),
  form_date: Joi.string().allow('', null).max(20),
  previous_month_count: Joi.number().integer().min(0).allow(null),
  started_count: Joi.number().integer().min(0).allow(null),
  left_count: Joi.number().integer().min(0).allow(null),
  payable_count: Joi.number().integer().min(0).allow(null),
  departures: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        leave_date: Joi.string().allow('', null).max(20),
        leave_reason: Joi.string().allow('', null).max(200),
      })
    )
    .max(20),
  starters: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        iban: Joi.string().allow('', null).max(40),
        start_reason: Joi.string().allow('', null).max(200),
        start_date: Joi.string().allow('', null).max(20),
      })
    )
    .max(20),
  other_changes: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        previous_status: Joi.string().allow('', null).max(200),
        new_status: Joi.string().allow('', null).max(200),
      })
    )
    .max(20),
  deductions: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        reason: Joi.string().allow('', null).max(200),
        amount: Joi.string().allow('', null).max(50),
      })
    )
    .max(20),
  report_days: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        start_date: Joi.string().allow('', null).max(20),
        days_after_7: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
      })
    )
    .max(20),
  union_changes: Joi.array()
    .items(
      Joi.object({
        ...rowPerson,
        left_union: Joi.string().allow('', null).max(150),
        joined_union: Joi.string().allow('', null).max(150),
      })
    )
    .max(20),
}).default({});

const upsertSalaryFormDraftSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  payload: salaryFormPayloadSchema.required(),
});

const periodQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
});

/** Bölüme göre tek satır eklerken (append) kabul edilen satır şekilleri. */
const APPEND_ROW_SCHEMAS = {
  departures: Joi.object({
    ...rowPerson,
    leave_date: Joi.string().allow('', null).max(20),
    leave_reason: Joi.string().allow('', null).max(200),
  }),
  starters: Joi.object({
    ...rowPerson,
    iban: Joi.string().allow('', null).max(40),
    start_reason: Joi.string().allow('', null).max(200),
    start_date: Joi.string().allow('', null).max(20),
  }),
  other_changes: Joi.object({
    ...rowPerson,
    previous_status: Joi.string().allow('', null).max(200),
    new_status: Joi.string().allow('', null).max(200),
  }),
  deductions: Joi.object({
    ...rowPerson,
    reason: Joi.string().allow('', null).max(200),
    amount: Joi.string().allow('', null).max(50),
  }),
  report_days: Joi.object({
    ...rowPerson,
    start_date: Joi.string().allow('', null).max(20),
    days_after_7: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
  }),
  union_changes: Joi.object({
    ...rowPerson,
    left_union: Joi.string().allow('', null).max(150),
    joined_union: Joi.string().allow('', null).max(150),
  }),
};

const appendSalaryFormRowSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  section: Joi.string()
    .valid(...Object.keys(APPEND_ROW_SCHEMAS))
    .required(),
  row: Joi.alternatives()
    .conditional('section', {
      switch: Object.keys(APPEND_ROW_SCHEMAS).map((section) => ({
        is: section,
        then: APPEND_ROW_SCHEMAS[section],
      })),
    })
    .required(),
});

module.exports = {
  upsertSalaryFormDraftSchema,
  periodQuerySchema,
  appendSalaryFormRowSchema,
  salaryFormPayloadSchema,
};
