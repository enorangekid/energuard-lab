-- 매출분석(sales-analysis.html) + naver-ad-report Edge Function이 사용하는 전체 스키마.
-- 새 환경 세팅 시 이 파일을 Supabase SQL Editor에서 그대로 실행하면 된다 (모두 idempotent).

-- (레거시) 주문내역 업로드용 — 현재 화면에서는 사용하지 않음
create table if not exists public.sales_upload_rows (
  id bigserial primary key,
  platform text not null,
  store_name text not null default '',
  order_date date,
  product_code text not null default '',
  product_name text not null default '',
  option_name text not null default '',
  quantity numeric not null default 0,
  sales_amount numeric not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists sales_upload_rows_order_date_idx
  on public.sales_upload_rows(order_date desc);

create index if not exists sales_upload_rows_product_code_idx
  on public.sales_upload_rows(product_code);

create table if not exists public.naver_ad_campaign_daily (
  id bigserial primary key,
  store_name text not null default '',
  report_date date not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  campaign_type text not null default '',
  campaign_status text not null default '',
  impressions numeric not null default 0,
  clicks numeric not null default 0,
  ctr numeric not null default 0,
  cpc numeric not null default 0,
  cost numeric not null default 0,
  conversions numeric not null default 0,
  conversion_rate numeric not null default 0,
  conversion_sales numeric not null default 0,
  purchase_conversions numeric not null default 0,
  purchase_sales numeric not null default 0,
  fetched_at timestamptz not null default now(),
  unique(store_name, report_date, campaign_id)
);

create index if not exists naver_ad_campaign_daily_store_date_idx
  on public.naver_ad_campaign_daily(store_name, report_date desc);

create index if not exists naver_ad_campaign_daily_campaign_idx
  on public.naver_ad_campaign_daily(campaign_id);

-- ─────────────────────────────────────────────────────────────
-- 쿠팡 광고 (광고관리 "일별 × 광고그룹" 보고서 엑셀 업로드)
-- placement: "검색 영역" / "비검색 영역"
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupang_ad_daily (
  report_date date not null,
  campaign text not null default '',
  ad_group text not null default '',
  placement text not null default '',
  ad_type text not null default '',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost numeric not null default 0,
  orders bigint not null default 0,          -- 총 주문수(14일)
  sales numeric not null default 0,          -- 총 전환매출액(14일)
  orders_1d bigint not null default 0,
  sales_1d numeric not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (report_date, campaign, ad_group, placement)
);
alter table public.coupang_ad_daily enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 쿠팡 매출 (셀러 인사이트 "일별 요약" 엑셀 업로드)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupang_sales_daily (
  report_date date primary key,
  visitors bigint not null default 0,
  views bigint not null default 0,
  carts bigint not null default 0,
  orders bigint not null default 0,
  qty bigint not null default 0,
  sales numeric not null default 0,
  fetched_at timestamptz not null default now()
);
alter table public.coupang_sales_daily enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 쿠팡 상품별 (셀러 인사이트 "상품별" 엑셀 — 날짜가 없어 기간 스냅샷으로 저장)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupang_item_snapshot (
  period_from date not null,
  period_to date not null,
  option_id text not null,
  option_name text not null default '',
  product_name text not null default '',
  product_id text not null default '',
  category text not null default '',
  sales numeric not null default 0,
  orders bigint not null default 0,
  qty bigint not null default 0,
  visitors bigint not null default 0,
  views bigint not null default 0,
  carts bigint not null default 0,
  item_winner_ratio numeric not null default 0,
  cancel_amount numeric not null default 0,
  cancel_qty bigint not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (period_from, period_to, option_id)
);
alter table public.coupang_item_snapshot enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 쿠팡 상품목록(Wing "가격/재고 관리" 다운로드) — 옵션ID → 노출상품ID(Product ID) 매핑.
-- 노출상품ID는 상품이 다른 그룹으로 묶이거나 분리될 때 바뀔 수 있어서, 상품목록을 다시
-- 업로드하면 그때마다 전체를 지우고 새로 채운다(스냅샷이 아니라 "현재 상태" 하나만 유지).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupang_product_map (
  option_id text primary key,
  product_id text not null default '',
  vendor_product_id text not null default '',
  product_name text not null default '',
  fetched_at timestamptz not null default now()
);
alter table public.coupang_product_map enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 네이버 판매분석 (비즈어드바이저 엑셀 3종 업로드)
-- 상품성과(sales2): 일별 × 채널상품 ("전체" 행 = 스토어 일별 합계)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.naver_product_daily (
  report_date date not null,
  product_id text not null,
  product_name text not null default '',
  pay_count bigint not null default 0,
  refund_count bigint not null default 0,
  sales_total numeric not null default 0,
  sales_net numeric not null default 0,
  refund_amount numeric not null default 0,
  qty bigint not null default 0,
  refund_qty bigint not null default 0,
  visits bigint not null default 0,
  conversion numeric not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (report_date, product_id)
);
alter table public.naver_product_daily enable row level security;

-- 유입경로(visit): 일별 × 경로 3단계 ("전체" 행 포함)
create table if not exists public.naver_visit_daily (
  report_date date not null,
  path1 text not null default '',
  path2 text not null default '',
  path3 text not null default '',
  visits bigint not null default 0,
  pay_count bigint not null default 0,
  conversion numeric not null default 0,
  sales_total numeric not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (report_date, path1, path2, path3)
);
alter table public.naver_visit_daily enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 아이템발굴: 실시간 급상승 키워드 스냅샷 (shopping-trend 함수가 시간대별 저장)
-- list_type: realtime(시그널+네이트 통합) / google(구글 급상승)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.realtime_trend_snapshot (
  slot text not null,          -- "2026-07-09 10:00" (KST 시간 단위)
  list_type text not null,
  rank int not null,
  keyword text not null,
  sources text not null default '',
  captured_at timestamptz not null default now(),
  primary key (slot, list_type, rank)
);
alter table public.realtime_trend_snapshot enable row level security;

-- 고객(customer): 월별 스냅샷 × 고객분류(전체합산/신규/재구매)
create table if not exists public.naver_customer_snapshot (
  period_from date not null,
  period_to date not null,
  segment text not null,
  visitor_count bigint not null default 0,
  payer_count bigint not null default 0,
  conversion numeric not null default 0,
  sales_total numeric not null default 0,
  avg_payment numeric not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (period_from, period_to, segment)
);
alter table public.naver_customer_snapshot enable row level security;
