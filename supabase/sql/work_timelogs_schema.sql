-- 업무 타임라인(admin/work-notes.html의 "업무기록 > 업무 타임라인") — Admin_backup의
-- time_logs(js/tasks.js) 이식. work_notes와 같은 이유로 별도 테이블 + authenticated 전용 RLS.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

create table if not exists public.work_timelogs (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  category   text not null,
  task       text not null,
  start_time text, -- "HH:MM" — 휴무 등 시간 없는 항목은 null
  end_time   text,
  duration   text not null default '0:00', -- "H:MM" 표시용 문자열(legacy와 동일하게 미리 계산해 저장)
  minutes    integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists work_timelogs_date_idx on public.work_timelogs (date desc, start_time);

alter table public.work_timelogs enable row level security;

do $$
begin
  create policy "work_timelogs_authenticated_all" on public.work_timelogs
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;
