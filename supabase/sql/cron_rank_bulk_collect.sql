-- 랭킹추적 상품(키워드 일괄 수집) 매일 자동 수집 (pg_cron → naver-rank 함수의 collectStoreKeywords 액션)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- ⚠ 실행 전 아래가 먼저 되어 있어야 합니다:
--   1) custom_tracked_keywords.sql 실행 완료
--   2) naver-rank Edge Function이 collectStoreKeywords 액션을 포함한 최신 버전으로 배포
--
-- 스토어 2곳(한국 단열/에너가드컴퍼니)을 각각 별도 잡으로 등록 — 한쪽이 실패해도 다른 쪽엔 영향 없음.
-- 기존 daily-tracked-item-collect(아이템추적, collectTracked)는 그대로 둔다 — tracked_items에는
-- 이 키워드 트리에 없는 임의 키워드도 등록될 수 있어서 완전히 겹치지 않는다(단, 겹치는 키워드는
-- 이 잡의 피기백으로도 채워지므로 이중 수집이라 해도 데이터가 틀어지진 않는다).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-rank-collect-hkdy');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('daily-rank-collect-energuard');
exception when others then null;
end $$;

-- 매일 KST 06:30 (UTC 21:30) — 아이템추적(07:00)보다 먼저 돌려 API 부하를 시간대로 분산
select cron.schedule(
  'daily-rank-collect-hkdy',
  '30 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '한국 단열')
  );
  $$
);

select cron.schedule(
  'daily-rank-collect-energuard',
  '30 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '에너가드컴퍼니')
  );
  $$
);

-- 등록 확인 (jobname, schedule이 둘 다 보이면 성공)
select jobid, jobname, schedule, active from cron.job
where jobname in ('daily-rank-collect-hkdy', 'daily-rank-collect-energuard');

-- 참고:
--   실행 이력 확인: select * from cron.job_run_details where jobid in (
--                     select jobid from cron.job where jobname like 'daily-rank-collect-%'
--                   ) order by start_time desc limit 20;
--   중단하려면:     select cron.unschedule('daily-rank-collect-hkdy');
--                   select cron.unschedule('daily-rank-collect-energuard');
--   시간 변경:      이 파일의 '30 21 * * *'(UTC 기준)를 바꿔 전체 재실행
