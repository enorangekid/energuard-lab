-- item-discovery.html의 "삭제"(휴지통)/"복구" 기능이 deleted_at 컬럼을 전제로 만들어져 있는데
-- 실제 테이블엔 이 컬럼이 없어서, 삭제 버튼을 눌러도 서버 PATCH가 "column does not exist"로 매번
-- 조용히 실패하고 있었다(프론트가 응답 성공 여부를 확인하지 않아서 화면에는 삭제된 것처럼 보였을 뿐,
-- 새로고침하면 서버엔 그대로 남아 있던 항목이 다시 나타남). 컬럼을 추가해서 실제로 동작하게 한다.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

alter table public.content_ideas
  add column if not exists deleted_at timestamptz;
