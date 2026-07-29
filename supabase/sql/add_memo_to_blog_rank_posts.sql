-- 블로그 분석 — 포스팅별 메모 저장 컬럼
-- Supabase SQL Editor에서 한 번 실행하세요. (idempotent)

alter table public.blog_rank_posts
  add column if not exists memo text not null default '';
