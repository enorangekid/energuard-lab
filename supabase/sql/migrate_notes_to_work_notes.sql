-- Admin_backup의 기존 업무노트(public.notes, 72건)를 새 work_notes로 1회성 이관.
-- 같은 Supabase 프로젝트 안에 두 테이블이 공존하므로 단순 복사이며, 원본 notes 테이블은
-- 건드리지 않는다(Admin_backup이 폐기되기 전까지는 그대로 남겨둠).
-- 재실행해도 중복 삽입되지 않도록 NOT EXISTS 가드를 걸어뒀다.
-- Supabase 대시보드 SQL Editor에서 실행하세요. (work_notes_schema.sql을 먼저 실행한 뒤에 실행할 것)

insert into public.work_notes (type, date, title, content, status, saved_at, created_at)
select n.type, n.date, n.title, n.content, n.status, n.saved_at, n.saved_at
from public.notes n
where not exists (
  select 1 from public.work_notes w
  where w.type = n.type
    and w.date = n.date
    and w.title is not distinct from n.title
    and w.saved_at = n.saved_at
);
