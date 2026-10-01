'use strict';

const { Op } = require('sequelize');
const { sequelize, TimetableRun, TimetableLesson, TimetableAssignment, TimetableProject } = require('../models');
const solver = require('./timetableSolverClient');
const { buildPayload } = require('./timetableBuildService');
const gemini = require('./geminiService');
const licenseService = require('./licenseService');
const aiUsage = require('./aiUsageService');
const { placeWithAi } = require('./timetableAiPlacer');

const POLL_MS = 2000;
const pollers = new Map();

const ACTIVE_STATUSES = ['kuyrukta', 'calisiyor'];

async function startRun(project, { userId, timeLimit }) {
  const active = await TimetableRun.findOne({
    where: { project_id: project.id, status: { [Op.in]: ACTIVE_STATUSES } },
  });
  if (active) {
    const err = new Error('Bu çalışma için zaten devam eden bir program oluşturma işlemi var');
    err.status = 409;
    throw err;
  }

  const payload = await buildPayload(project, { timeLimit });
  const run = await TimetableRun.create({
    tenant_id: project.tenant_id,
    project_id: project.id,
    status: 'kuyrukta',
    time_limit: payload.time_limit,
    created_by: userId || null,
  });

  try {
    const { job_id: jobId } = await solver.createJob(payload);
    await run.update({ job_id: jobId, status: 'calisiyor', started_at: new Date() });
    startPolling(run.id);
  } catch (err) {
    await run.update({ status: 'basarisiz', error: err.message, finished_at: new Date() });
    throw err;
  }
  return run;
}

function startPolling(runId) {
  if (pollers.has(runId)) return;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const done = await pollOnce(runId);
      if (done) stopPolling(runId);
    } catch (err) {
      console.error(`[timetable] run ${runId} poll failed:`, err.message);
    } finally {
      busy = false;
    }
  }, POLL_MS);
  pollers.set(runId, timer);
}

function stopPolling(runId) {
  const timer = pollers.get(runId);
  if (timer) clearInterval(timer);
  pollers.delete(runId);
}

// true dönerse iş bitmiştir.
async function pollOnce(runId) {
  const run = await TimetableRun.findByPk(runId);
  if (!run || !ACTIVE_STATUSES.includes(run.status) || !run.job_id) return true;

  let job;
  try {
    job = await solver.getJob(run.job_id);
  } catch (err) {
    if (err.status === 404) {
      await run.update({
        status: 'basarisiz',
        error: 'Çözücü servisi yeniden başladığı için iş kayboldu. Tekrar çalıştırın.',
        finished_at: new Date(),
      });
      return true;
    }
    throw err;
  }

  if (job.status === 'queued' || job.status === 'running') {
    if (job.progress) {
      await run.update({
        progress: job.progress,
        objective: job.progress.objective ?? run.objective,
        best_bound: job.progress.best_bound ?? run.best_bound,
      });
    }
    return false;
  }

  const result = job.result || {};
  let lessons = Array.isArray(result.lessons) && result.lessons.length ? result.lessons : null;
  let solverStatus = result.status || null;
  let diagnostics = result.diagnostics || [];
  let score = result.score;
  let violations = result.violations;
  let objective = result.objective ?? run.objective;

  if (!lessons && canAskAi(job, result)) {
    const ai = await tryAiFallback(run, result);
    if (ai?.lessons?.length) {
      lessons = ai.lessons;
      solverStatus = 'AI';
      diagnostics = ai.diagnostics;
      score = {};
      violations = [];
      objective = null;
    } else if (ai?.diagnostics?.length) {
      diagnostics = [...diagnostics, ...ai.diagnostics];
    }
  }

  const hasLessons = Boolean(lessons?.length);
  let status = 'tamamlandi';
  if (job.status === 'failed') status = 'basarisiz';
  else if (job.status === 'cancelled' && !hasLessons) status = 'iptal';
  else if (!hasLessons) status = 'basarisiz';

  await run.update({
    status,
    solver_status: solverStatus,
    objective,
    best_bound: result.best_bound ?? run.best_bound,
    result: hasLessons ? { lessons, score, violations } : null,
    diagnostics,
    error: job.error || null,
    finished_at: new Date(),
  });

  // İlk başarılı sonuç doğrudan taslağa uygulanır; sonrakiler kullanıcı onayıyla.
  if (hasLessons) {
    const existing = await TimetableLesson.count({ where: { project_id: run.project_id } });
    if (existing === 0) await applyRun(run);
  }
  return true;
}

function canAskAi(job, result) {
  if (job.status === 'failed' || job.status === 'cancelled') return false;
  if (result.status === 'CANCELLED' || result.status === 'INVALID') return false;
  return true;
}

// Çözücü ders üretemediyse ve kiracıda yapay zekâ lisansı varsa yerleştirmeyi dener.
// Lisans yoksa null döner; çağrı hata verirse kotayı iade eder.
async function tryAiFallback(run, result) {
  const project = await TimetableProject.findByPk(run.project_id);
  if (!project) return null;
  const license = await licenseService.getActiveAiLicense(project.tenant_id);
  if (!license) return null;
  if (!gemini.isEnabled()) {
    return {
      diagnostics: [
        {
          level: 'warning',
          message: 'Çözücü uygun program bulamadı. Yapay zekâ lisansınız var ama sunucuda anahtar tanımlı değil.',
        },
      ],
    };
  }

  const limit = aiUsage.resolveLimit(license);
  try {
    await aiUsage.consume(project.tenant_id, limit);
  } catch (err) {
    return { diagnostics: [{ level: 'warning', message: err.message }] };
  }

  await run.update({
    progress: {
      phase: 'ai',
      message: 'Çözücü uygun program bulamadı. Yapay zekâ yerleştiriyor.',
      solutions: run.progress?.solutions || 0,
      objective: run.objective,
      best_bound: run.best_bound,
      elapsed: run.progress?.elapsed,
    },
  });

  try {
    const payload = await buildPayload(project);
    const placed = await placeWithAi(payload, result.diagnostics || []);
    if (!placed.ok) return { diagnostics: [{ level: 'error', message: placed.message }] };
    return {
      lessons: placed.lessons,
      diagnostics: [
        {
          level: 'warning',
          message: `Çözücü uygun program bulamadı (${result.status || 'sonuç yok'}). ${placed.lessons.length} ders saati yapay zekâ ile yerleştirildi. Taslağı kontrol edin.`,
        },
        ...placed.warnings,
      ],
    };
  } catch (err) {
    await aiUsage.refund(project.tenant_id);
    return {
      diagnostics: [{ level: 'error', message: `Yapay zekâ yerleştirmesi yapılamadı: ${err.message}` }],
    };
  }
}

async function cancelRun(run) {
  if (!ACTIVE_STATUSES.includes(run.status)) return run;
  if (run.job_id) {
    try {
      await solver.cancelJob(run.job_id);
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }
  if (!run.job_id) await run.update({ status: 'iptal', finished_at: new Date() });
  return run;
}

/** Çözüm sonucunu projenin taslak ders tablosuna yazar (mevcut taslağı değiştirir). */
async function applyRun(run) {
  const lessons = run.result?.lessons || [];
  if (!lessons.length) {
    const err = new Error('Bu çalıştırmanın uygulanabilir bir sonucu yok');
    err.status = 400;
    throw err;
  }
  const assignmentIds = new Set(
    (await TimetableAssignment.findAll({ where: { project_id: run.project_id }, attributes: ['id'] })).map((a) => a.id)
  );

  await sequelize.transaction(async (transaction) => {
    const locked = await TimetableLesson.findAll({
      where: { project_id: run.project_id, is_locked: true },
      transaction,
    });
    const lockedKeys = new Set(locked.map((l) => `${l.assignment_id}:${l.day_of_week}:${l.period_no}`));
    await TimetableLesson.destroy({ where: { project_id: run.project_id }, transaction });
    await TimetableLesson.bulkCreate(
      lessons
        .filter((l) => assignmentIds.has(l.assignment_id))
        .map((l) => ({
          tenant_id: run.tenant_id,
          project_id: run.project_id,
          assignment_id: l.assignment_id,
          day_of_week: l.day,
          period_no: l.period,
          room_id: l.room_id || null,
          is_locked: lockedKeys.has(`${l.assignment_id}:${l.day}:${l.period}`),
        })),
      { transaction }
    );
    await run.update({ applied_at: new Date() }, { transaction });
  });
  return run;
}

/** Sunucu açılışında yarım kalan işlerin takibini sürdürür. */
async function resumeActiveRuns() {
  try {
    const runs = await TimetableRun.findAll({ where: { status: { [Op.in]: ACTIVE_STATUSES } } });
    for (const run of runs) {
      if (run.job_id) startPolling(run.id);
      else await run.update({ status: 'basarisiz', error: 'Sunucu yeniden başladı', finished_at: new Date() });
    }
  } catch (err) {
    console.error('[timetable] resume failed:', err.message);
  }
}

module.exports = { startRun, cancelRun, applyRun, resumeActiveRuns, ACTIVE_STATUSES };
