-- 블로그 분석 — 포스팅 중심 구조로 재설계
-- 1차 시도(오늘 낮): 블로그 단위로 키워드 풀을 만들고 "이 블로그의 아무 포스팅이나" 검색결과에
--   걸리는지 확인하는 구조였다. 실제로 원하는 건 반대였다: 포스팅이 우선이고, "이 포스팅 자체"가
--   어떤 키워드로 몇 위인지, 그 키워드의 검색량은 얼마인지를 보고 싶은 것.
-- 최종 구조: 블로그 등록 → RSS로 포스팅 자동 수집(변경 없음) → 포스팅마다 키워드를 추적
--   (AI가 그 포스팅 제목에서 자동 추출하거나 직접 추가) → 정확히 "그 포스팅"이 검색결과
--   (실제 블로그탭 화면 / 공식 API)에 몇 위인지 + 검색광고 API 검색량을 같이 저장한다.
-- Supabase 대시보드 SQL Editor에서 실행하세요. (idempotent)

drop table if exists public.blog_rank_history;
drop table if exists public.blog_rank_tracked_keywords; -- 오늘 낮의 "블로그 단위 키워드" 시도, 폐기
drop table if exists public.blog_rank_targets;           -- 훨씬 이전의 "포스팅 URL 수동 등록" 시도, 폐기

-- 추적 대상 블로그
create table if not exists public.blog_rank_blogs (
  blog_id text primary key,              -- 네이버 blogId (예: taekwonv123)
  blog_name text not null default '',
  is_mine boolean not null default false, -- true = 내 블로그, false = 경쟁사 블로그
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 블로그별 포스팅 목록 (RSS로 자동 수집)
create table if not exists public.blog_rank_posts (
  blog_id text not null references public.blog_rank_blogs(blog_id) on delete cascade,
  log_no text not null,
  title text not null default '',
  post_url text not null default '',
  memo text not null default '',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  primary key (blog_id, log_no)
);

-- 포스팅별 추적 키워드 (AI 자동 추출 또는 직접 추가) — 검색량도 같이 저장
create table if not exists public.blog_rank_post_keywords (
  id bigserial primary key,
  blog_id text not null,
  log_no text not null,
  keyword text not null,
  source text not null default 'manual',   -- 'manual' | 'auto'
  search_volume integer,                   -- 네이버 검색광고 API 월간 검색량 (조회 실패 시 null)
  device text not null default 'desktop',  -- 'desktop' | 'mobile'
  max_rank integer not null default 300,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (blog_id, log_no) references public.blog_rank_posts(blog_id, log_no) on delete cascade,
  unique (blog_id, log_no, keyword, device)
);

-- 일별 순위 스냅샷 — "이 포스팅 자체"가 그 키워드에서 몇 위인지 (실제 화면 / 공식 API 분리)
create table if not exists public.blog_rank_history (
  blog_id text not null,
  log_no text not null,
  keyword text not null,
  provider text not null,                 -- 'naver_blog_screen' | 'naver_blog_api'
  device text not null default 'desktop',
  rank integer,                           -- null = max_rank 안에서 못 찾음
  page integer,
  found boolean not null default false,
  checked_count integer not null default 0,
  collected_date date not null default (now() at time zone 'utc')::date,
  collected_at timestamptz not null default now(),
  primary key (blog_id, log_no, keyword, provider, device, collected_date)
);

create index if not exists blog_rank_history_lookup_idx
  on public.blog_rank_history (blog_id, log_no, keyword, collected_date desc);

alter table public.blog_rank_blogs enable row level security;
alter table public.blog_rank_posts enable row level security;
alter table public.blog_rank_post_keywords enable row level security;
alter table public.blog_rank_history enable row level security;

drop policy if exists "blog_rank_blogs_all" on public.blog_rank_blogs;
create policy "blog_rank_blogs_all" on public.blog_rank_blogs for all to anon using (true) with check (true);

drop policy if exists "blog_rank_posts_all" on public.blog_rank_posts;
create policy "blog_rank_posts_all" on public.blog_rank_posts for all to anon using (true) with check (true);

drop policy if exists "blog_rank_post_keywords_all" on public.blog_rank_post_keywords;
create policy "blog_rank_post_keywords_all" on public.blog_rank_post_keywords for all to anon using (true) with check (true);

drop policy if exists "blog_rank_history_all" on public.blog_rank_history;
create policy "blog_rank_history_all" on public.blog_rank_history for all to anon using (true) with check (true);
