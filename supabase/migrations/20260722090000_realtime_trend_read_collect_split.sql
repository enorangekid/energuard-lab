-- 실시간 트렌드 화면 조회와 외부 수집을 분리한다.
-- 화면은 realtime(읽기 전용), cron은 collectRealtime(수집+저장)을 호출한다.

do $$
begin
  perform cron.unschedule('realtime-trend-collect-3h');
exception when others then
  null;
end $$;

select cron.schedule(
  'realtime-trend-collect-3h',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/shopping-trend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectRealtime')
  );
  $$
);
