-- 랭킹추적 기능용 테이블
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- (테이블이 이미 있든 없든 처음부터 끝까지 그대로 실행해도 안전합니다 — 전부 idempotent)
-- ⚠ 아래에 기존 데이터를 비우는 truncate가 포함되어 있습니다 (테스트 데이터라 삭제해도 된다고 확인함).

create table if not exists public.keyword_rank_history (
  id bigint generated always as identity primary key,
  store_name text not null,
  keyword text not null,
  main_keyword text not null,      -- 보조 키워드면 소속된 메인 키워드, 메인이면 keyword와 동일
  is_sub boolean not null default false,
  rank integer,                    -- null = max_rank 안에서 못 찾음(이탈)
  max_rank integer not null default 400,
  checked_at timestamptz not null default now()
);

-- 테이블이 이전 버전으로 이미 만들어져 있어도 없는 컬럼만 안전하게 추가됨
alter table public.keyword_rank_history add column if not exists product_code text;
alter table public.keyword_rank_history add column if not exists product_name text;
alter table public.keyword_rank_history add column if not exists product_image text;
alter table public.keyword_rank_history add column if not exists product_link text;
alter table public.keyword_rank_history add column if not exists product_price integer;
alter table public.keyword_rank_history add column if not exists batch_id text;   -- 더 이상 안 쓰지만 컬럼만 남겨둠 (참조 데이터 없음)
alter table public.keyword_rank_history add column if not exists collected_date date;

-- 기존(테스트) 데이터 비우기 — 새 구조(날짜별 upsert)와 맞지 않는 예전 방식으로 쌓인 데이터라 정리
truncate table public.keyword_rank_history;

-- 날짜 단위 upsert(같은 스토어+키워드+상품이면 하루에 한 행만 유지)를 위한 컬럼 정리
-- (NULL은 유니크 제약에서 서로 다른 값 취급되므로 빈 문자열/기본값으로 통일)
alter table public.keyword_rank_history alter column product_code set default '';
alter table public.keyword_rank_history alter column product_name set default '';
alter table public.keyword_rank_history alter column product_image set default '';
alter table public.keyword_rank_history alter column product_link set default '';
alter table public.keyword_rank_history alter column product_price set default 0;
alter table public.keyword_rank_history alter column product_code set not null;
alter table public.keyword_rank_history alter column product_name set not null;
alter table public.keyword_rank_history alter column product_image set not null;
alter table public.keyword_rank_history alter column product_link set not null;
alter table public.keyword_rank_history alter column product_price set not null;
alter table public.keyword_rank_history alter column collected_date set not null;
alter table public.keyword_rank_history alter column collected_date set default (now() at time zone 'utc')::date;

-- 인덱스
create index if not exists keyword_rank_history_lookup_idx
  on public.keyword_rank_history (store_name, keyword, checked_at desc);

create unique index if not exists keyword_rank_history_daily_uidx
  on public.keyword_rank_history (store_name, keyword, product_code, collected_date);

-- RLS + 정책 (프론트에서 anon 키로 직접 insert/update/select — 이 프로젝트의 기존 신뢰 모델과 동일)
alter table public.keyword_rank_history enable row level security;

drop policy if exists "keyword_rank_history_insert" on public.keyword_rank_history;
create policy "keyword_rank_history_insert" on public.keyword_rank_history
  for insert to anon with check (true);

drop policy if exists "keyword_rank_history_update" on public.keyword_rank_history;
create policy "keyword_rank_history_update" on public.keyword_rank_history
  for update to anon using (true) with check (true);

drop policy if exists "keyword_rank_history_select" on public.keyword_rank_history;
create policy "keyword_rank_history_select" on public.keyword_rank_history
  for select to anon using (true);

drop policy if exists "keyword_rank_history_delete" on public.keyword_rank_history;
create policy "keyword_rank_history_delete" on public.keyword_rank_history
  for delete to anon using (true);
