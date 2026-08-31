-- N+스토어 수집 시 같이 잡히는 광고 슬롯(순위 계산에서는 걸러내던 isAd=true 레코드)을
-- 별도로 저장해서 "키워드별 광고 압박도" / "경쟁사 광고 강도 리더보드" 지표를 만든다.
-- coupang_rank_items/coupang_rank_history와 같은 시기에 추가하는 베타 전용 테이블이라
-- 20260820170000_lock_public_tables_to_admins.sql이 잠근 기존 테이블 목록엔 없다 —
-- 새 테이블은 이 블록으로 직접 RLS를 걸어야 한다.

create table if not exists public.ad_slot_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,              -- 수집 컨텍스트(우리가 추적 중인 스토어명)
  keyword text not null,
  main_keyword text not null default '',
  is_sub boolean not null default false,
  slot_no integer not null,              -- 광고 노출 순서(1부터, 화면에 나온 순서 그대로)
  mall_name text not null default '',    -- 광고주(몰) 이름
  product_code text not null default '',
  product_name text not null default '',
  product_price numeric not null default 0,
  source text not null default 'nplus_store',
  collected_date date not null default (now() at time zone 'utc')::date,
  checked_at timestamptz not null default now()
);

create unique index if not exists ad_slot_snapshots_unique_idx
  on public.ad_slot_snapshots (store_name, keyword, collected_date, source, slot_no);
create index if not exists ad_slot_snapshots_keyword_idx
  on public.ad_slot_snapshots (keyword, checked_at desc);
create index if not exists ad_slot_snapshots_mall_idx
  on public.ad_slot_snapshots (mall_name, collected_date desc);

alter table public.ad_slot_snapshots enable row level security;

revoke all on table public.ad_slot_snapshots from anon;
grant select, insert, update, delete on table public.ad_slot_snapshots to authenticated;

drop policy if exists energeguard_admin_all on public.ad_slot_snapshots;
create policy energeguard_admin_all on public.ad_slot_snapshots
  for all to authenticated using (public.is_energuard_admin()) with check (public.is_energuard_admin());
