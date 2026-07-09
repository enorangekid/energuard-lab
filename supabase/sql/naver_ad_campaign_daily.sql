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
