-- 블로그 진단 탭 — 블로그 지수 / 방문자 현황 / 블로그차트 카테고리 랭킹
-- whereispost.com에서 블로그ID로 조회한 스냅샷(블로그 지수, 이웃수, 방문자수)과
-- 블로그차트 로그인 세션으로 조회한 카테고리 랭킹을 매일 한 행으로 저장한다.
-- AI인용 현황은 수동 카운터로 만들었다가 실효성이 없어 폐기했다 (blog_rank_ai_citations 삭제).
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

drop table if exists public.blog_rank_ai_citations;

create table if not exists public.blog_rank_diagnosis (
  blog_id text not null references public.blog_rank_blogs(blog_id) on delete cascade,
  snapshot_date date not null default (now() at time zone 'utc')::date,
  blog_level integer,          -- whereispost "블로그 지수" Level N
  neighbor_count integer,      -- 이웃 수
  visitors_today integer,      -- 오늘 방문자
  visitors_avg integer,        -- 평균 방문자
  visitors_total integer,      -- 전체 방문자
  collected_at timestamptz not null default now(),
  primary key (blog_id, snapshot_date)
);

-- 블로그차트 로그인 세션으로 조회한 카테고리 랭킹 (insight.blogchart.co.kr/user/blog)
alter table public.blog_rank_diagnosis add column if not exists category_label text;
alter table public.blog_rank_diagnosis add column if not exists category_rank integer;
alter table public.blog_rank_diagnosis add column if not exists best_rank integer;
alter table public.blog_rank_diagnosis add column if not exists valid_keyword_count integer;
alter table public.blog_rank_diagnosis add column if not exists total_keyword_count integer;

alter table public.blog_rank_diagnosis enable row level security;

drop policy if exists "blog_rank_diagnosis_all" on public.blog_rank_diagnosis;
create policy "blog_rank_diagnosis_all" on public.blog_rank_diagnosis for all to anon using (true) with check (true);
