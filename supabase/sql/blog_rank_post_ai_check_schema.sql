-- "최근 게시글 진단"의 AI 인용 최적화 점수 중 스크래핑으로는 판정 불가능한 항목
-- (결론 우선 배치/본문 구조화/니치 소재/AI 기계생성 여부/과도한 홍보문구/채널 주제 일관성)을
-- LLM(OpenAI)에게 판정시켜 저장한다. 비용이 드는 호출이라 수동 버튼으로만 채워진다 —
-- 자동 새로고침 대상이 아니다.
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

create table if not exists public.blog_rank_post_ai_check (
  blog_id text not null,
  log_no text not null,
  conclusion_first boolean,
  structured_flow boolean,
  niche_topic boolean,
  ai_generated boolean,
  excessive_promo boolean,
  channel_consistent boolean,
  reasoning text,
  checked_at timestamptz not null default now(),
  primary key (blog_id, log_no),
  foreign key (blog_id, log_no) references public.blog_rank_posts(blog_id, log_no) on delete cascade
);

alter table public.blog_rank_post_ai_check enable row level security;

drop policy if exists "blog_rank_post_ai_check_all" on public.blog_rank_post_ai_check;
create policy "blog_rank_post_ai_check_all" on public.blog_rank_post_ai_check for all to anon using (true) with check (true);
