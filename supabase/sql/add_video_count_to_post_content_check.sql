-- blog_rank_post_content_check에 동영상 개수(video_count) 컬럼 추가
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

alter table public.blog_rank_post_content_check
  add column if not exists video_count integer;
