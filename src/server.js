require('dotenv').config();
const cron = require('node-cron');
const { app, connectDb } = require('./app');
const { processWorkTaskReminders } = require('./services/workTaskReminderService');
const { refreshStudentAges } = require('./services/studentAgeService');
const { startBackupCron } = require('./services/backupService');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const WORK_TASK_CRON = process.env.WORK_TASK_CRON || '*/15 * * * *';
const STUDENT_AGE_CRON = process.env.STUDENT_AGE_CRON || '5 0 * * *';
const STUDENT_AGE_TZ = 'Europe/Istanbul';

function startWorkTaskReminderCron() {
  if (String(process.env.WORK_TASK_REMINDERS_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Work task reminders disabled (WORK_TASK_REMINDERS_ENABLED=false)');
    return;
  }
  if (!cron.validate(WORK_TASK_CRON)) {
    console.warn(`Invalid WORK_TASK_CRON "${WORK_TASK_CRON}", reminders not scheduled`);
    return;
  }
  cron.schedule(WORK_TASK_CRON, async () => {
    try {
      const result = await processWorkTaskReminders();
      if (result.reminders > 0 || result.overdues > 0) {
        console.log(
          `[work-tasks] reminders=${result.reminders} overdues=${result.overdues} checked=${result.checked}`
        );
      }
    } catch (err) {
      console.error('[work-tasks] reminder job failed:', err.message);
    }
  });
  console.log(`Work task reminder cron scheduled: ${WORK_TASK_CRON}`);
}

function startStudentAgeCron() {
  if (String(process.env.STUDENT_AGE_CRON_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Student age cron disabled (STUDENT_AGE_CRON_ENABLED=false)');
    return;
  }
  if (!cron.validate(STUDENT_AGE_CRON)) {
    console.warn(`Invalid STUDENT_AGE_CRON "${STUDENT_AGE_CRON}", age refresh not scheduled`);
    return;
  }
  cron.schedule(
    STUDENT_AGE_CRON,
    async () => {
      try {
        const result = await refreshStudentAges();
        console.log(`[student-age] updated=${result.updated} checked=${result.checked}`);
      } catch (err) {
        console.error('[student-age] job failed:', err.message);
      }
    },
    { timezone: STUDENT_AGE_TZ }
  );
  console.log(`Student age cron scheduled: ${STUDENT_AGE_CRON} (${STUDENT_AGE_TZ})`);
}

(async () => {
  await connectDb();
  startWorkTaskReminderCron();
  startStudentAgeCron();
  await startBackupCron();
  app.listen(PORT, HOST, () => console.log(`Server listening ${HOST}:${PORT}`));
})();
