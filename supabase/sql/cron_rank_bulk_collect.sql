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
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '한국 단열'),
    -- net.http_post 기본 timeout_milliseconds가 1000(1초)이라, 함수가 130초짜리 예산으로
    -- 도는데 응답을 기다리다 바로 포기해버려 net._http_response에 결과가 안 남는다
    -- (실제 수집 자체는 서버에서 계속 진행됨 — 그냥 응답 확인만 안 되는 것). 함수 예산보다
    -- 넉넉하게 잡아서 응답이 제대로 기록되게 한다.
    timeout_milliseconds := 145000
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
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '에너가드컴퍼니'),
    timeout_milliseconds := 145000
  );
  $$
);

-- 등록 확인 (jobname, schedule이 둘 다 보이면 성공)
select jobid, jobname, schedule, active from cron.job
where jobname in ('daily-rank-collect-hkdy', 'daily-rank-collect-energuard');

-- 참고:
--   실행 이력 확인:   select * from cron.job_run_details where jobid in (
--                       select jobid from cron.job where jobname like 'daily-rank-collect-%'
--                     ) order by start_time desc limit 20;
--   실제 응답/미수집 확인 (timeout_milliseconds 적용 이후 실행분부터 정상 기록됨):
--     select r.created, r.status_code,
--            r.content::jsonb ->> 'storeName' as 스토어,
--            (r.content::jsonb ->> 'keywords')::int as 전체키워드,
--            (r.content::jsonb ->> 'keywordsDone')::int as 처리한키워드
--     from net._http_response r
--     where r.created > now() - interval '7 days'
--     order by r.created desc limit 30;
--   중단하려면:       select cron.unschedule('daily-rank-collect-hkdy');
--                     select cron.unschedule('daily-rank-collect-energuard');
--   시간 변경:      이 파일의 '30 21 * * *'(UTC 기준)를 바꿔 전체 재실행
