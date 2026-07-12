-- 네이버 광고 데이터 매일 자동 수집 (pg_cron → naver-ad-report 함수의 collect 액션)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
--
-- 동작: 매일 KST 06:00 / 06:20 / 06:40 세 번 호출.
--   대상 기간 = 어제부터 10일 전까지 (간접전환이 최대 7일 소급되므로 최근 7일은 재수집 대상).
--   collect 액션이 미수집일 + 갱신 대상일을 골라 호출당 최대 7일씩 처리하고,
--   1시간 내 수집분은 건너뛰므로 두 번째·세 번째 호출은 남은 날짜만 이어받는다 (없으면 즉시 종료).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-naver-ad-collect');
exception when others then
  null; -- 처음 실행이라 잡이 없으면 무시
end $$;

-- UTC 21:00/21:20/21:40 = KST 06:00/06:20/06:40 (전날 데이터가 집계된 새벽 시간대)
select cron.schedule(
  'daily-naver-ad-collect',
  '0,20,40 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-ad-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object(
      'action', 'collect',
      'store', '한국 단열',
      'dateFrom', to_char((now() at time zone 'Asia/Seoul')::date - 10, 'YYYY-MM-DD'),
      'dateTo',   to_char((now() at time zone 'Asia/Seoul')::date - 1,  'YYYY-MM-DD'),
      'maxDays', 7
    )
  );
  $$
);

-- 등록 확인 (jobname, schedule이 보이면 성공)
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-naver-ad-collect';

-- 참고:
--   실행 이력 확인: select * from cron.job_run_details order by start_time desc limit 10;
--   중단하려면:     select cron.unschedule('daily-naver-ad-collect');
