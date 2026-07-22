-- 아이템발굴 실시간 트렌드 자동 수집
-- 목적:
--   1) realtime_trend_snapshot은 오늘+어제 데이터만 유지한다.
--   2) shopping-trend 함수의 realtime 액션을 3시간마다 호출한다.
--   3) 같은 시간대(slot)는 함수 내부 saveSnapshot에서 덮어쓴다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 기존 오래된 스냅샷 정리: 오늘 0시 기준 어제 0시보다 오래된 데이터 삭제
delete from public.realtime_trend_snapshot
where slot < to_char(
  (now() at time zone 'Asia/Seoul')::date - interval '1 day',
  'YYYY-MM-DD'
) || ' 00:00';

-- 자동 후보는 이제 함수에서 날짜 단위 id로 덮어쓴다.
-- 이미 쌓여 있던 오래된 자동 후보 중 아직 처리하지 않은 candidate만 정리한다.
delete from public.content_ideas
where source = 'trend'
  and status = 'candidate'
  and updated_at < now() - interval '2 days';

do $$
begin
  perform cron.unschedule('realtime-trend-collect-3h');
exception when others then
  null;
end $$;

-- 매 3시간마다 실행 (UTC 기준). KST로는 00/03/06/09/12/15/18/21시 실행.
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
    body := jsonb_build_object('action', 'realtime')
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'realtime-trend-collect-3h';
