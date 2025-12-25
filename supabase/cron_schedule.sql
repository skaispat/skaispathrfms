-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the job to run at 06:20 UTC (11:50 AM IST) daily
-- We use '06:20' because UTC is 5.30 hours behind IST.
select cron.schedule(
  'daily-attendance-report-job', -- Job name
  '20 6 * * *',                  -- Cron schedule (20th minute of 6th hour UTC)
  $$
  select
    net.http_post(
        -- URL of your Edge Function
        url:='https://ulgviqruyccrjncetqsv.supabase.co/functions/v1/daily-attendance-report',
        
        -- Headers (Content-Type is standard)
        headers:='{"Content-Type": "application/json"}'::jsonb,
        
        -- Body (Empty JSON object as default)
        body:='{}'::jsonb
    ) as request_id;
  $$
);

/* 
   To check scheduled jobs:
   select * from cron.job;

   To unschedule/delete:
   select cron.unschedule('daily-attendance-report-job');
*/
