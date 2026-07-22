insert into public.realtime_trend_archive (slot, list_type, rank, keyword, sources, captured_at)
select slot, list_type, rank, keyword, sources, captured_at
from public.realtime_trend_snapshot
where list_type in ('realtime', 'google')
on conflict (slot, list_type, keyword) do nothing;
