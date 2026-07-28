-- 블로그 진단(블로그 지수/방문자 - whereispost.com, 카테고리 랭킹 - 블로그차트) 매일 자동 수집
-- (pg_cron → blog-rank 함수의 collectDiagnosis 액션)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- ⚠ 실행 전 blog-rank Edge Function이 collectDiagnosis 액션을 포함한 최신 버전으로 배포되어 있어야 합니다.
--
-- "오늘 방문자"는 whereispost가 그날 실시간으로 증가하는 진행 중 숫자를 보여주는 거라, 하루가
-- 다 끝나기 직전에 찍어야 그나마 그날 최종치에 가깝다 — 그래서 자정 직전(KST 23:50)에 돈다.
-- blogId를 안 넘기면 collectDiagnosis가 is_mine=true인 블로그(현재 taekwonv123) 전체를 처리한다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-blog-diagnosis-collect');
exception when others then
  null; -- 처음 실행이라 잡이 없으면 무시
end $$;

-- 매일 KST 23:50 (UTC 14:50)
select cron.schedule(
  'daily-blog-diagnosis-collect',
  '50 14 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/blog-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := '{"action":"collectDiagnosis"}'::jsonb,
    -- net.http_post 기본 timeout_milliseconds는 1000(1초)이라 응답을 오래 기다리지 못하고
    -- 포기해버린다 — whereispost/블로그차트 스크래핑 두 번이면 1초를 넘기기 쉬워서 넉넉히 잡는다.
    timeout_milliseconds := 30000
  );
  $$
);

-- 등록 확인 (jobname, schedule이 보이면 성공)
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-blog-diagnosis-collect';

-- 참고:
--   실행 이력 확인:   select * from cron.job_run_details where jobid = (
--                       select jobid from cron.job where jobname = 'daily-blog-diagnosis-collect'
--                     ) order by start_time desc limit 10;
--   실제 응답 확인:
--     select r.created, r.status_code, r.content::jsonb ->> 'collected' as collected,
--            r.content::jsonb -> 'errors' as errors
--     from net._http_response r
--     where r.created > now() - interval '7 days'
--     order by r.created desc limit 20;
--   중단하려면:       select cron.unschedule('daily-blog-diagnosis-collect');
--   시간 변경:        이 파일의 '50 14 * * *'(UTC 기준)를 바꿔 전체 재실행
--                     예) KST 23:55 = '55 14 * * *', KST 23:45 = '45 14 * * *'
