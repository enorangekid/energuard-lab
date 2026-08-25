-- 쿠팡 순위 추적 기능용 테이블 (tracked_items와 같은 "링크 붙여넣기 등록" 모델을 쿠팡에 맞춤).
-- 쿠팡 검색결과 링크 자체에 rank/searchRank 쿼리파라미터가 박혀 있어서, 확장프로그램이 별도로
-- 페이지 내 위치를 세지 않고 그 값을 그대로 저장한다(coupang-page-collector.js 참고).

create table if not exists public.coupang_rank_items (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  product_url text not null default '',
  product_id text not null,
  item_id text not null default '',
  vendor_item_id text not null default '',
  product_name text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coupang_rank_items_unique_idx
  on public.coupang_rank_items (keyword, product_id, item_id, vendor_item_id);

-- 재검색 1회 = 1행. 같은 날 여러 번 재검색하면 최신 결과로 덮어쓴다(upsert).
create table if not exists public.coupang_rank_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.coupang_rank_items(id) on delete cascade,
  keyword text not null,
  rank integer,                          -- null = 조회한 페이지 범위 안에서 못 찾음
  max_rank integer not null default 0,   -- 그날 몇 위까지 확인했는지(페이지 수 × 페이지당 노출수)
  collected_date date not null default (now() at time zone 'utc')::date,
  checked_at timestamptz not null default now(),
  note text not null default ''          -- 차단/오류 메시지 등
);

create unique index if not exists coupang_rank_history_unique_idx
  on public.coupang_rank_history (item_id, collected_date);
create index if not exists coupang_rank_history_lookup_idx
  on public.coupang_rank_history (item_id, collected_date desc);

-- RLS — 20260820170000_lock_public_tables_to_admins.sql이 그 시점에 존재하던 테이블만
-- 잠갔으므로, 그 뒤에 새로 만드는 테이블은 매번 이 블록을 직접 붙여줘야 한다.
alter table public.coupang_rank_items enable row level security;
alter table public.coupang_rank_history enable row level security;

revoke all on table public.coupang_rank_items from anon;
revoke all on table public.coupang_rank_history from anon;
grant select, insert, update, delete on table public.coupang_rank_items to authenticated;
grant select, insert, update, delete on table public.coupang_rank_history to authenticated;

drop policy if exists energeguard_admin_all on public.coupang_rank_items;
create policy energeguard_admin_all on public.coupang_rank_items
  for all to authenticated using (public.is_energuard_admin()) with check (public.is_energuard_admin());

drop policy if exists energeguard_admin_all on public.coupang_rank_history;
create policy energeguard_admin_all on public.coupang_rank_history
  for all to authenticated using (public.is_energuard_admin()) with check (public.is_energuard_admin());
