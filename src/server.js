require('dotenv').config();
const cron = require('node-cron');
const { app, connectDb } = require('./app');
const { processWorkTaskReminders } = require('./services/workTaskReminderService');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const WORK_TASK_CRON = process.env.WORK_TASK_CRON || '*/15 * * * *';

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

(async () => {
  await connectDb();
  startWorkTaskReminderCron();
  app.listen(PORT, HOST, () => console.log(`Server listening ${HOST}:${PORT}`));
})();
