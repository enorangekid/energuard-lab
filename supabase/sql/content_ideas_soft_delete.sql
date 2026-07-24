-- 발굴 키워드 소프트 삭제 지원 (아이템발굴 "삭제됨" 탭)
-- 기존엔 삭제 버튼을 누르면 content_ideas/content_drafts 행을 바로 지웠는데(deleteContentIdea),
-- 이제는 일반 삭제는 deleted_at만 채워서 목록에서 숨기고 "삭제됨" 탭에서 복구할 수 있게 한다.
-- "삭제됨" 탭 안에서 다시 삭제를 누르면 그때는 기존처럼 완전 삭제(deleteContentIdea)로 처리한다.
-- Supabase 대시보드 SQL Editor에서 실행하세요. (idempotent)

alter table public.content_ideas
  add column if not exists deleted_at timestamptz;

create index if not exists content_ideas_deleted_at_idx
  on public.content_ideas(deleted_at);

-- content_ideas는 이미 anon update 정책이 있어서(content ideas anon update) deleted_at을
-- 채우거나 비우는 것도 그 정책으로 커버된다 — 별도 정책 추가는 필요 없음.
