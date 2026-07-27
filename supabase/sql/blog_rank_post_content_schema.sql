-- 게시글 진단 모달 — 포스팅 본문(모바일 페이지)을 분석해서 글자수/사진수/댓글수/인용구/외부링크를 뽑는다.
-- 공감(좋아요) 수는 정적 페이지에 없어서(별도 API로 로드되는 것으로 보임) 제외했다.
-- 히스토리 없이 포스팅당 최신 분석 결과만 유지한다 (blog_rank_post_title_check와 같은 패턴).
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

create table if not exists public.blog_rank_post_content_check (
  blog_id text not null,
  log_no text not null,
  thumbnail_url text,
  char_count integer,
  image_count integer,
  comment_count integer,
  quote_count integer,
  external_link_count integer,
  checked_at timestamptz not null default now(),
  primary key (blog_id, log_no),
  foreign key (blog_id, log_no) references public.blog_rank_posts(blog_id, log_no) on delete cascade
);

alter table public.blog_rank_post_content_check enable row level security;

drop policy if exists "blog_rank_post_content_check_all" on public.blog_rank_post_content_check;
create policy "blog_rank_post_content_check_all" on public.blog_rank_post_content_check for all to anon using (true) with check (true);
