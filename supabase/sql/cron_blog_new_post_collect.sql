-- 신규 포스팅 수집(RSS 확인) 매일 자동 실행 (pg_cron → blog-rank 함수의 refreshRecent 액션)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
--
-- refreshRecent는 검색결과 스크래핑이 아니라 블로그 RSS 피드(rss.blog.naver.com)만 가볍게
-- 확인하는 액션이라 자동화해도 어뷰징 리스크가 낮다(같은 이유로 daily-blog-diagnosis-collect도
-- 이미 자동으로 돌고 있음). 반면 노출 진단(collectExposure, 메인/보조 키워드 수집)은
-- search.naver.com 화면 스크래핑이라 리스크가 다르므로 여기 포함하지 않았다 — 계속 수동 유지.
--
-- 보통 오전 9시쯤 새 글을 올린다고 해서, 그날 글이 RSS에 반영될 시간을 30분 정도 두고
-- KST 09:30에 돈다. 내 블로그(scope 없음)와 경쟁사(scope:"competitor")를 각각 별도 잡으로
-- 등록해서 한쪽이 실패해도 다른 쪽엔 영향 없게 한다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-blog-new-post-collect-mine');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('daily-blog-new-post-collect-competitor');
exception when others then null;
end $$;

-- 매일 KST 09:30 (UTC 00:30) — 내 블로그
select cron.schedule(
  'daily-blog-new-post-collect-mine',
  '30 0 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/blog-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'x-energuard-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'energuard_cron_secret' limit 1)
    ),
    body := '{"action":"refreshRecent"}'::jsonb,
    -- net.http_post 기본 timeout_milliseconds는 1000(1초)이라 응답을 오래 기다리지 못하고
    -- 포기해버린다 — refreshRecent의 60초 예산보다 넉넉하게 잡는다.
    timeout_milliseconds := 70000
  );
  $$
);

-- 매일 KST 09:30 (UTC 00:30) — 경쟁사 블로그
select cron.schedule(
  'daily-blog-new-post-collect-competitor',
  '30 0 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/blog-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'x-energuard-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'energuard_cron_secret' limit 1)
    ),
    body := jsonb_build_object('action', 'refreshRecent', 'scope', 'competitor'),
    timeout_milliseconds := 70000
  );
  $$
);

-- 등록 확인 (jobname 2개, schedule이 다 보이면 성공)
select jobid, jobname, schedule, active from cron.job
where jobname in ('daily-blog-new-post-collect-mine', 'daily-blog-new-post-collect-competitor');

-- 참고:
--   실행 이력 확인:   select * from cron.job_run_details where jobid in (
--                       select jobid from cron.job where jobname like 'daily-blog-new-post-collect-%'
--                     ) order by start_time desc limit 10;
--   실제 응답 확인:
--     select r.created, r.status_code,
--            (r.content::jsonb ->> 'collected')::int as 확인한블로그수,
--            r.content::jsonb -> 'errors' as errors
--     from net._http_response r
--     where r.created > now() - interval '7 days'
--     order by r.created desc limit 20;
--   중단하려면:       select cron.unschedule('daily-blog-new-post-collect-mine');
--                     select cron.unschedule('daily-blog-new-post-collect-competitor');
--   시간 변경:        이 파일의 '30 0 * * *'(UTC 기준)를 바꿔 전체 재실행
--                     예) KST 10:00 = '0 1 * * *', KST 09:00 = '0 0 * * *'
