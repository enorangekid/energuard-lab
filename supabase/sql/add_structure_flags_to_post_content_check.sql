-- blog_rank_post_content_check에 "AI 인용 최적화 점수"의 목록화/비교표 배치 판정용 플래그 추가
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

alter table public.blog_rank_post_content_check
  add column if not exists has_list boolean;
alter table public.blog_rank_post_content_check
  add column if not exists has_table boolean;
