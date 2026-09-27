-- shopping_search_snapshots 오래된 행 정리를 배치(LIMIT)로 나눠서 지우는 함수.
-- 원인: background.js의 cleanupOldSnapshots()가 collected_date < cutoff 조건 하나로
-- 전체 범위를 한 번의 DELETE로 지웠는데, authenticated 롤의 statement_timeout이 8초라서
-- (select rolconfig from pg_roles where rolname='authenticated'로 확인) 수집을 며칠 쉬어서
-- 정리 안 된 날짜가 쌓이면(2026-09-28 실측: 이틀치 47,476행, 스토어당 하루 최대 19,000행+)
-- 8초 안에 못 끝내고 57014(statement timeout)로 실패했다. 심지어 정상적으로 매일 도는
-- 상황에서도 "한국 단열" 스토어 하루치만 19,000행 안팎이라 8초에 아슬아슬하다.
-- ctid로 5,000행씩 끊어서 지우면 한 번의 DELETE가 항상 짧게 끝나고, background.js는
-- 반환된 삭제 행 수가 0이 될 때까지 반복 호출한다.
-- Supabase 대시보드 SQL Editor에서 그대로 실행하세요. (idempotent)

create or replace function public.cleanup_old_shopping_search_snapshots(
  cutoff_date date,
  batch_size int default 5000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.shopping_search_snapshots
  where ctid in (
    select ctid from public.shopping_search_snapshots
    where collected_date < cutoff_date
    limit batch_size
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_shopping_search_snapshots(date, int) from public, anon;
grant execute on function public.cleanup_old_shopping_search_snapshots(date, int) to authenticated;
