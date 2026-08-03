-- Browser-collected Naver Shopping result snapshots.
-- Raw search results are stored first; store/tracked-item ranks are derived afterwards.

create table if not exists public.shopping_search_snapshots (
  id bigint generated always as identity primary key,
  run_id text not null,
  store_name text not null,
  keyword text not null,
  main_keyword text not null,
  is_sub boolean not null default false,
  collected_date date not null default (now() at time zone 'utc')::date,
  collected_at timestamptz not null default now(),
  page_index integer not null,
  page_position integer not null,
  organic_rank integer,
  slot_rank integer,
  is_ad boolean not null default false,
  product_key text not null,
  product_code text not null default '',
  naver_product_id text not null default '',
  product_name text not null default '',
  mall_name text not null default '',
  channel_no text not null default '',
  provider_id text not null default '',
  product_image text not null default '',
  product_link text not null default '',
  product_price integer not null default 0,
  shipping_fee integer not null default 0,
  purchase_count integer not null default 0,
  review_count integer not null default 0,
  registration_date text not null default '',
  brand text not null default '',
  maker text not null default '',
  category_path text not null default '',
  specs jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  is_target_store boolean not null default false,
  is_tracked boolean not null default false,
  extraction_source text not null default ''
);

create unique index if not exists shopping_search_snapshots_daily_uidx
  on public.shopping_search_snapshots (store_name, keyword, collected_date, is_ad, product_key);

create index if not exists shopping_search_snapshots_rank_idx
  on public.shopping_search_snapshots (store_name, keyword, collected_date desc, organic_rank);

create index if not exists shopping_search_snapshots_product_idx
  on public.shopping_search_snapshots (product_code, collected_date desc);

alter table public.shopping_search_snapshots enable row level security;

drop policy if exists "shopping_search_snapshots_all" on public.shopping_search_snapshots;
create policy "shopping_search_snapshots_all" on public.shopping_search_snapshots
  for all to anon using (true) with check (true);

