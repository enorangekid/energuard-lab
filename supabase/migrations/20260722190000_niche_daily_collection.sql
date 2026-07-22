create table if not exists public.niche_trend_daily_snapshot (
  snapshot_date date not null,
  list_type text not null check (list_type in ('news', 'spike')),
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  primary key (snapshot_date, list_type)
);

create index if not exists niche_trend_daily_snapshot_latest_idx
  on public.niche_trend_daily_snapshot(list_type, snapshot_date desc);

alter table public.niche_trend_daily_snapshot enable row level security;

do $$
begin
  perform cron.unschedule('niche-trend-collect-daily');
exception when others then
  null;
end $$;

-- UTC 21:15 = KST 06:15. 뉴스와 검색량 집계가 안정된 뒤 하루 한 번 저장한다.
select cron.schedule(
  'niche-trend-collect-daily',
  '15 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/shopping-trend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectNicheDaily')
  );
  $$
);
