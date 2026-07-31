-- Admin_backup의 기존 업무 타임라인(public.time_logs)을 새 work_timelogs로 1회성 이관.
-- 같은 Supabase 프로젝트 안에 두 테이블이 공존하므로 단순 복사이며, 원본 time_logs 테이블은
-- 건드리지 않는다(Admin_backup이 폐기되기 전까지는 그대로 남겨둠).
-- 재실행해도 중복 삽입되지 않도록 NOT EXISTS 가드를 걸어뒀다.
-- Supabase 대시보드 SQL Editor에서 실행하세요. (work_timelogs_schema.sql을 먼저 실행한 뒤에 실행할 것)

insert into public.work_timelogs (date, category, task, start_time, end_time, duration, minutes, created_at)
select
  t.date,
  t.category,
  t.task,
  case when t.start_time is not null then to_char(t.start_time, 'HH24:MI') end,
  case when t.end_time is not null then to_char(t.end_time, 'HH24:MI') end,
  t.duration,
  coalesce(t.min, 0),
  coalesce(t.created_at, now())
from public.time_logs t
where not exists (
  select 1 from public.work_timelogs w
  where w.date = t.date
    and w.task = t.task
    and w.category = t.category
    and w.start_time is not distinct from case when t.start_time is not null then to_char(t.start_time, 'HH24:MI') end
);
