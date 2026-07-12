-- 아이템 추적 매일 자동 수집 (pg_cron → naver-rank 함수 호출)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- ⚠ 실행 전 naver-rank Edge Function이 collectTracked 액션을 포함한 최신 버전으로 배포되어 있어야 합니다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 이미 같은 이름의 잡이 있으면 제거 후 다시 등록 (스케줄 변경 시에도 이 파일만 다시 실행하면 됨)
do $$
begin
  perform cron.unschedule('daily-tracked-item-collect');
exception when others then
  null; -- 처음 실행이라 잡이 없으면 무시
end $$;

-- 매일 KST 07:00 (UTC 22:00) — 장 시작 전에 전날 변동까지 반영된 스냅샷을 확보
select cron.schedule(
  'daily-tracked-item-collect',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := '{"action":"collectTracked"}'::jsonb
  );
  $$
);

-- 등록 확인 (jobname, schedule이 보이면 성공)
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-tracked-item-collect';

-- 참고:
--   실행 이력 확인: select * from cron.job_run_details order by start_time desc limit 10;
--   중단하려면:     select cron.unschedule('daily-tracked-item-collect');
--   시간 변경:      이 파일의 '0 22 * * *'(UTC 기준)를 바꿔 전체 재실행
--                   예) KST 06:00 = '0 21 * * *', KST 12:00 = '0 3 * * *'
