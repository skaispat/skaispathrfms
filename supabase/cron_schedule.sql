-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- JOB 1: 6:00 AM IST - Sync External API Data to Database
-- UTC Time: 00:30 (IST is UTC+5:30)
-- ============================================================
select cron.schedule(
  'sync-attendance-data-6am',    -- Job name
  '30 0 * * *',                  -- Cron: 00:30 UTC = 6:00 AM IST
  $$
  select
    net.http_post(
        url:='',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- JOB 2: 10:00 AM IST - Generate PDF Report for Yesterday + WhatsApp
-- UTC Time: 04:30 (IST is UTC+5:30)
-- ============================================================
select cron.schedule(
  'daily-attendance-report-job', -- Job name
  '30 4 * * *',                  -- Cron: 04:30 UTC = 10:00 AM IST
  $$
  select
    net.http_post(
        url:='https://ulgviqruyccrjncetqsv.supabase.co/functions/v1/daily-attendance-report',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- JOB 3: 2:00 PM IST - Today's IN Report (only employees with IN time)
-- UTC Time: 08:30 (IST is UTC+5:30)
-- ============================================================
select cron.schedule(
  'today-in-report-job',         -- Job name
  '30 8 * * *',                  -- Cron: 08:30 UTC = 2:00 PM IST
  $$
  select
    net.http_post(
        url:='https://ulgviqruyccrjncetqsv.supabase.co/functions/v1/today-in-report',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

/* 
   ============================================================
   HELPFUL COMMANDS
   ============================================================
   
   To check all scheduled jobs:
   SELECT * FROM cron.job;

   To check job run history:
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

   To unschedule/delete jobs:
   SELECT cron.unschedule('sync-attendance-data-6am');
   SELECT cron.unschedule('daily-attendance-report-job');
   SELECT cron.unschedule('today-in-report-job');
*/

