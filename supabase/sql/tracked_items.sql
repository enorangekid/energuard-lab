-- 아이템 추적 기능용 테이블 (내 상품/경쟁사 상품의 키워드 순위 + 판매가 변동 추적)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요. (전부 idempotent)

-- 추적 대상 마스터: 링크 붙여넣기로 등록. 상품명/이미지/가격 등 메타는
-- 첫 수집 때 검색 결과에서 자동으로 채워진다.
create table if not exists public.tracked_items (
  product_code text primary key,
  product_name text not null default '',
  product_image text not null default '',
  product_link text not null default '',
  mall_name text not null default '',
  is_mine boolean not null default false,   -- true = 내 상품, false = 경쟁사
  memo text not null default '',
  keywords jsonb not null default '[]',     -- 추적 키워드 배열 ["열반사단열재", ...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 일별 스냅샷: 키워드별 순위와 그날의 판매가를 같은 행에 저장 (가격-순위 교차 분석용)
create table if not exists public.tracked_item_history (
  product_code text not null,
  keyword text not null,
  rank integer,                             -- null = 1000위 안에서 못 찾음(이탈)
  price integer not null default 0,         -- 그날 검색 결과에 노출된 판매가 (0 = 미확인)
  mall_name text not null default '',
  collected_date date not null default (now() at time zone 'utc')::date,
  checked_at timestamptz not null default now(),
  primary key (product_code, keyword, collected_date)
);

create index if not exists tracked_item_history_lookup_idx
  on public.tracked_item_history (product_code, collected_date desc);

-- RLS + 정책 (프론트에서 anon 키로 직접 CRUD — keyword_rank_history와 동일한 신뢰 모델)
alter table public.tracked_items enable row level security;
alter table public.tracked_item_history enable row level security;

drop policy if exists "tracked_items_all" on public.tracked_items;
create policy "tracked_items_all" on public.tracked_items
  for all to anon using (true) with check (true);

drop policy if exists "tracked_item_history_all" on public.tracked_item_history;
create policy "tracked_item_history_all" on public.tracked_item_history
  for all to anon using (true) with check (true);
