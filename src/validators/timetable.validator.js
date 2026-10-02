const Joi = require('joi');
const { TYPES } = require('../services/timetableConstraintCatalog');

const id = Joi.number().integer().positive();
const weights = Joi.object({
  teacher_gaps: Joi.number().integer().min(0).max(1000),
  class_compact: Joi.number().integer().min(0).max(1000),
  teacher_single_hour_day: Joi.number().integer().min(0).max(1000),
  hard_subject_late: Joi.number().integer().min(0).max(1000),
  soft_constraint: Joi.number().integer().min(0).max(1000),
  availability_avoid: Joi.number().integer().min(0).max(1000),
  block_flex: Joi.number().integer().min(0).max(1000),
  teacher_day_off: Joi.number().integer().min(0).max(1000),
});
const distribution = Joi.object({
  place_seconds: Joi.number().integer().min(10).max(600),
  gap_seconds: Joi.number().integer().min(0).max(600),
  split_double: Joi.boolean(),
  merge_singles: Joi.boolean(),
  merge_two_one: Joi.boolean(),
  eliminate_gaps: Joi.boolean(),
  free_day: Joi.boolean(),
  same_class_subjects: Joi.string().valid('off', 'soft', 'hard'),
  prioritize_difficulty: Joi.boolean(),
  max_daily_hours: Joi.number().integer().min(0).max(12),
  max_windows: Joi.number().integer().min(0).max(40),
  workers: Joi.number().integer().min(1).max(8),
  methods: Joi.string().valid('all', 'single'),
  algorithms: Joi.array().items(Joi.string().valid('cpsat', 'greedy', 'local')).min(1).unique(),
});
const teacherOverride = Joi.object({
  max_daily_hours: Joi.number().integer().min(0).max(12).allow(null),
  max_windows: Joi.number().integer().min(0).max(40).allow(null),
  free_day: Joi.boolean().allow(null),
  same_class_subjects: Joi.string().valid('inherit', 'off', 'on').allow(null),
});
const dayBreak = Joi.object({
  day: Joi.number().integer().min(1).max(7).required(),
  after_period: Joi.number().integer().min(1).max(12).required(),
  minutes: Joi.number().integer().min(0).max(120).required(),
});
const bell = Joi.object({
  start_time: Joi.string().pattern(/^\d{2}:\d{2}$/),
  lesson_minutes: Joi.number().integer().min(20).max(120),
  break_minutes: Joi.number().integer().min(0).max(60),
  breaks: Joi.array().items(Joi.number().integer().min(0).max(120)).max(11),
  day_breaks: Joi.array().items(dayBreak).max(14),
});
const settings = Joi.object({
  time_limit: Joi.number().integer().min(10).max(600),
  max_subject_daily: Joi.number().integer().min(1).max(12),
  max_culture_daily: Joi.number().integer().min(1).max(8),
  max_vocational_daily: Joi.number().integer().min(1).max(12),
  weights,
  bell,
  block_across_lunch: Joi.boolean(),
  class_lunch: Joi.object().pattern(/^\d+$/, Joi.number().integer().min(1).max(11)),
  distribution,
  teacher_overrides: Joi.object().pattern(/^\d+$/, teacherOverride),
});

const projectBase = {
  name: Joi.string().trim().max(150),
  academic_year: Joi.string().allow('', null).max(20),
  days: Joi.array().items(Joi.number().integer().min(1).max(7)).min(1).max(7).unique(),
  periods_per_day: Joi.number().integer().min(1).max(12),
  lunch_after: Joi.number().integer().min(1).max(11).allow(null),
  settings,
};

const createProjectSchema = Joi.object({
  ...projectBase,
  school_id: id.required(),
  name: projectBase.name.required(),
  // Başka bir çalışmadan kopyalanacak veriler
  copy_from: Joi.object({
    project_id: id.required(),
    parts: Joi.array().items(Joi.string().valid('assignments', 'availability', 'constraints')).min(1).unique().required(),
  }),
});
const updateProjectSchema = Joi.object(projectBase).min(1);

const roomBase = {
  name: Joi.string().trim().max(100),
  room_type: Joi.string().allow('', null).max(50),
  capacity: Joi.number().integer().min(1).max(20),
  is_active: Joi.boolean(),
};
const createRoomSchema = Joi.object({ ...roomBase, school_id: id.required(), name: roomBase.name.required() });
const updateRoomSchema = Joi.object(roomBase).min(1);

const assignmentBase = {
  classroom_id: id,
  subject_id: id,
  teacher_id: id.allow(null),
  weekly_hours: Joi.number().integer().min(1).max(40),
  block_pattern: Joi.string().allow('', null).max(40),
  room_id: id.allow(null),
  sync_group: Joi.string().allow('', null).max(50),
  // Aynı gruptaki seçmeliler alternatif; boş = tüm şube girer
  elective_group: Joi.string().trim().allow('', null).max(30),
  // 2.-5. öğretmen
  co_teacher_ids: Joi.array().items(id).max(4).unique(),
  allow_split: Joi.boolean().allow(null),
  allow_merge: Joi.boolean().allow(null),
};
// Saat verilmezse ders havuzundaki seviye saati kullanılır.
const createAssignmentSchema = Joi.object({
  ...assignmentBase,
  classroom_id: id.required(),
  subject_id: id.required(),
});
// Boş: projenin tüm şubeleri
const syncCommonSchema = Joi.object({ classroom_ids: Joi.array().items(id).max(500).unique() });
// subject_ids boşsa şubenin kaldırılmış tüm ortak dersleri geri gelir
const restoreCommonSchema = Joi.object({
  classroom_id: id.required(),
  subject_ids: Joi.array().items(id).max(200).unique(),
});
const copyAssignmentsSchema = Joi.object({
  source_classroom_id: id.required(),
  target_classroom_ids: Joi.array().items(id).min(1).max(200).unique().required(),
  // replace: hedef şubenin mevcut dersleri silinir; aksi hâlde yalnız eksikler eklenir
  replace: Joi.boolean().default(false),
  with_teachers: Joi.boolean().default(false),
});
const updateAssignmentSchema = Joi.object(assignmentBase).min(1);
const bulkAssignmentSchema = Joi.object({
  ids: Joi.array().items(id).min(1).required(),
  teacher_id: id.allow(null),
  room_id: id.allow(null),
  sync_group: Joi.string().allow('', null).max(50),
}).or('teacher_id', 'room_id', 'sync_group');
const generateAssignmentsSchema = Joi.object({ overwrite: Joi.boolean().default(false) });

const cellsSchema = Joi.object().pattern(/^[1-7]-(?:[1-9]|1[0-2])$/, Joi.string().valid('closed', 'avoid', 'open'));
const availabilitySchema = Joi.object({
  entity_type: Joi.string().valid('school', 'teacher', 'classroom', 'room', 'subject').required(),
  entity_ids: Joi.array().items(Joi.number().integer().min(0)).min(1).max(500).unique().required(),
  // replace: hücreler baştan yazılır; patch: yalnız verilen hücreler değişir ("open" hücreyi açar)
  mode: Joi.string().valid('replace', 'patch').default('patch'),
  cells: cellsSchema.required(),
});

const electiveChoicesSchema = Joi.object({
  classroom_id: id.required(),
  // Şubenin tüm seçimleri baştan yazılır.
  choices: Joi.array()
    .items(Joi.object({ student_id: id.required(), assignment_ids: Joi.array().items(id).max(20).unique().required() }))
    .max(200)
    .required(),
});

const branchSchema = Joi.object({
  code: Joi.string().trim().allow('', null).max(20),
  name: Joi.string().trim().max(100),
});
const createBranchSchema = branchSchema.keys({ name: Joi.string().trim().max(100).required() });

const poolSubjectSchema = Joi.object({
  code: Joi.string().trim().allow('', null).max(20),
  branch_id: id.allow(null),
  difficulty_level: Joi.string().valid('kolay', 'orta', 'zor').allow(null),
  allow_split: Joi.boolean(),
  allow_merge: Joi.boolean(),
  is_elective: Joi.boolean(),
  course_kind: Joi.string().valid('kultur', 'meslek'),
  elective_group: Joi.string().trim().allow('', null).max(30),
  is_guidance: Joi.boolean(),
  is_activity: Joi.boolean(),
}).min(1);
const poolHourSchema = Joi.object({
  id: id.allow(null),
  subject_id: id.required(),
  class_level: Joi.string().trim().max(20).required(),
  // 0: id varsa o saat seçeneğini, yoksa bu seviyedeki tüm seçenekleri siler
  weekly_hours: Joi.number().integer().min(0).max(40).required(),
  block_pattern: Joi.string().allow('', null).max(40),
});

const constraintItem = Joi.object({
  type: Joi.string().valid(...Object.keys(TYPES)).required(),
  is_hard: Joi.boolean().required(),
  weight: Joi.number().integer().min(1).max(100).allow(null),
  params: Joi.object().unknown(true).required(),
  source: Joi.string().valid('manuel', 'ai'),
  source_text: Joi.string().allow('', null).max(2000),
});
const createConstraintsSchema = Joi.object({ items: Joi.array().items(constraintItem).min(1).max(50).required() });
const updateConstraintSchema = Joi.object({
  is_hard: Joi.boolean(),
  weight: Joi.number().integer().min(1).max(100).allow(null),
  params: Joi.object().unknown(true),
  is_active: Joi.boolean(),
}).min(1);
const aiParseSchema = Joi.object({ text: Joi.string().trim().min(3).max(2000).required() });

const startRunSchema = Joi.object({ time_limit: Joi.number().integer().min(10).max(600) });
const moveLessonSchema = Joi.object({
  day_of_week: Joi.number().integer().min(1).max(7).required(),
  period_no: Joi.number().integer().min(1).max(12).required(),
  force: Joi.boolean().default(false),
});
const lockLessonSchema = Joi.object({ is_locked: Joi.boolean().required() });
const lockAllSchema = Joi.object({ is_locked: Joi.boolean().required(), classroom_id: id, teacher_id: id });
// Boş gövde tüm taslağı siler; verilen alanlar birlikte uygulanır.
const clearLessonsSchema = Joi.object({
  classroom_id: id,
  teacher_id: id,
  room_id: id,
  day_of_week: Joi.number().integer().min(1).max(7),
  ids: Joi.array().items(id).min(1).max(5000).unique(),
});
// Boş gövde okulun bu eğitim yılındaki yayındaki programı siler.
const clearPublishedSchema = Joi.object({
  classroom_id: id,
  teacher_id: id,
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  createRoomSchema,
  updateRoomSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  bulkAssignmentSchema,
  generateAssignmentsSchema,
  copyAssignmentsSchema,
  syncCommonSchema,
  restoreCommonSchema,
  availabilitySchema,
  electiveChoicesSchema,
  createBranchSchema,
  updateBranchSchema: branchSchema.min(1),
  poolSubjectSchema,
  poolHourSchema,
  createConstraintsSchema,
  updateConstraintSchema,
  aiParseSchema,
  startRunSchema,
  moveLessonSchema,
  lockLessonSchema,
  lockAllSchema,
  clearLessonsSchema,
  clearPublishedSchema,
};
