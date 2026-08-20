-- 포스팅 순위(블로그 전체 키워드) + 최근 게시글 진단(썸네일/글자수 등) 매일 자동 수집
-- (pg_cron → blog-rank 함수의 collect 액션 — 여기에 게시글 콘텐츠 분석도 얹혀서 같이 돈다)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- ⚠ 실행 전 blog-rank Edge Function이 collect 액션(예산 가드 포함) 최신 버전으로 배포되어 있어야 합니다.
--
-- collectDiagnosis(대시보드, KST 23:50)보다 먼저 돌려서 API 부하를 시간대로 분산한다.
-- blogId를 안 넘기면 collect가 활성 키워드 전체(최대 50개, updated_at 오래된 순)를 처리한다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-blog-post-rank-collect');
exception when others then
  null; -- 처음 실행이라 잡이 없으면 무시
end $$;

-- 매일 KST 23:00 (UTC 14:00)
select cron.schedule(
  'daily-blog-post-rank-collect',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/blog-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'x-energuard-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'energuard_cron_secret' limit 1)
    ),
    body := '{"action":"collect"}'::jsonb,
    -- net.http_post 기본 timeout_milliseconds는 1000(1초)이라 응답을 오래 기다리지 못하고
    -- 포기해버린다 — 함수 예산(130초)보다 넉넉하게 잡아서 응답이 제대로 기록되게 한다.
    timeout_milliseconds := 145000
  );
  $$
);

-- 등록 확인 (jobname, schedule이 보이면 성공)
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-blog-post-rank-collect';

-- 참고:
--   실행 이력 확인:   select * from cron.job_run_details where jobid = (
--                       select jobid from cron.job where jobname = 'daily-blog-post-rank-collect'
--                     ) order by start_time desc limit 10;
--   실제 응답 확인:
--     select r.created, r.status_code, r.content::jsonb ->> 'collected' as collected,
--            r.content::jsonb -> 'errors' as errors
--     from net._http_response r
--     where r.created > now() - interval '7 days'
--     order by r.created desc limit 20;
--   중단하려면:       select cron.unschedule('daily-blog-post-rank-collect');
--   시간 변경:        이 파일의 '0 14 * * *'(UTC 기준)를 바꿔 전체 재실행
--                     예) KST 22:30 = '30 13 * * *'
