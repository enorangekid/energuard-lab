-- 노출 현황 진단 — 블로그 전체 기준으로 주요 키워드 52개를 하나씩 검색해서
-- "우리 블로그의 아무 포스팅이나" 결과에 걸리는지 확인한다. (포스팅별 키워드 추적과는 별개 시스템)
-- 누락은 키워드 검색이 아니라, 우리 포스팅 제목 자체를 검색어로 넣었을 때도 안 뜨는
-- 심각한 노출 문제를 잡아내는 것 — 포스팅별로 최신 상태만 저장한다.
-- 기존 blog_rank_* 테이블은 건드리지 않는 추가(additive) 스크립트입니다. (idempotent)

-- 블로그 전체 기준 주요 키워드 목록 (특정 포스팅에 미리 연결하지 않음)
create table if not exists public.blog_rank_target_keywords (
  id bigserial primary key,
  blog_id text not null references public.blog_rank_blogs(blog_id) on delete cascade,
  keyword text not null,
  category text not null default '서브',  -- '메인' | '서브'
  device text not null default 'desktop',
  max_rank integer not null default 300,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blog_id, keyword)
);

-- 키워드 검색 결과 이력 — 걸린 포스팅이 있으면 그 포스팅 정보까지 같이 저장
create table if not exists public.blog_rank_exposure_history (
  blog_id text not null,
  keyword text not null,
  provider text not null,                 -- 'naver_blog_screen' | 'naver_blog_api'
  device text not null default 'desktop',
  found boolean not null default false,
  rank integer,
  page integer,
  result_log_no text,
  result_title text,
  result_url text,
  checked_count integer not null default 0,
  checked_date date not null default (now() at time zone 'utc')::date,
  collected_at timestamptz not null default now(),
  primary key (blog_id, keyword, provider, device, checked_date)
);

create index if not exists blog_rank_exposure_history_lookup_idx
  on public.blog_rank_exposure_history (blog_id, keyword, checked_date desc);

-- 포스팅 자기 제목 검색 자가진단 — 히스토리 없이 포스팅당 최신 상태만 유지
create table if not exists public.blog_rank_post_title_check (
  blog_id text not null,
  log_no text not null,
  found boolean not null default false,
  checked_at timestamptz not null default now(),
  primary key (blog_id, log_no),
  foreign key (blog_id, log_no) references public.blog_rank_posts(blog_id, log_no) on delete cascade
);

alter table public.blog_rank_target_keywords enable row level security;
alter table public.blog_rank_exposure_history enable row level security;
alter table public.blog_rank_post_title_check enable row level security;

drop policy if exists "blog_rank_target_keywords_all" on public.blog_rank_target_keywords;
create policy "blog_rank_target_keywords_all" on public.blog_rank_target_keywords for all to anon using (true) with check (true);

drop policy if exists "blog_rank_exposure_history_all" on public.blog_rank_exposure_history;
create policy "blog_rank_exposure_history_all" on public.blog_rank_exposure_history for all to anon using (true) with check (true);

drop policy if exists "blog_rank_post_title_check_all" on public.blog_rank_post_title_check;
create policy "blog_rank_post_title_check_all" on public.blog_rank_post_title_check for all to anon using (true) with check (true);
