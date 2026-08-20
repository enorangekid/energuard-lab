-- Shopping Search API collection has been retired and is now handled by the
-- signed-in Chrome extension. Remove legacy server cron jobs that still call
-- the retired naver-rank collection actions.
do $$
declare
  target_job record;
begin
  for target_job in
    select jobid
    from cron.job
    where command like '%functions/v1/naver-rank%'
  loop
    perform cron.unschedule(target_job.jobid);
  end loop;
end $$;
