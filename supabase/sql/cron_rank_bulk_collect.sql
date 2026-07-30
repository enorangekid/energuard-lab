-- 랭킹추적 상품(키워드 일괄 수집) 매일 자동 수집 (pg_cron → naver-rank 함수의 collectStoreKeywords 액션)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요.
-- ⚠ 실행 전 아래가 먼저 되어 있어야 합니다:
--   1) custom_tracked_keywords.sql 실행 완료
--   2) naver-rank Edge Function이 collectStoreKeywords의 half 파라미터를 포함한 최신 버전으로 배포
--
-- 스토어 2곳(한국 단열/에너가드컴퍼니)을 각각 별도 잡으로 등록 — 한쪽이 실패해도 다른 쪽엔 영향 없음.
-- 기존 daily-tracked-item-collect(아이템추적, collectTracked)는 그대로 둔다 — tracked_items에는
-- 이 키워드 트리에 없는 임의 키워드도 등록될 수 있어서 완전히 겹치지 않는다(단, 겹치는 키워드는
-- 이 잡의 피기백으로도 채워지므로 이중 수집이라 해도 데이터가 틀어지진 않는다).
--
-- ⚠ 2026-07-30: "한국 단열"은 기본 키워드 트리(KW_TREE_DEFAULT)가 89개라 130초 예산 안에
--   하루치가 다 안 돌아(실측 82/89) 매일 몇 개씩 "미수집"으로 빠졌다. 회전 정렬(가장 오래
--   수집 안 된 키워드부터 처리)을 넣어도 89개 자체가 너무 많다는 근본 문제는 그대로라,
--   06:30/06:35 두 번으로 나눠 절반(half:1/half:2)씩 돌려서 매일 89개 전체가 다 돌게 한다.
--   "에너가드컴퍼니"는 22개뿐이라 분할 없이 그대로 한 번에 돈다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-rank-collect-hkdy');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('daily-rank-collect-hkdy-1');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('daily-rank-collect-hkdy-2');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('daily-rank-collect-energuard');
exception when others then null;
end $$;

-- 매일 KST 06:30 (UTC 21:30) — 한국 단열 절반(1/2). 아이템추적(07:00)보다 먼저 돌려 API 부하를 시간대로 분산
select cron.schedule(
  'daily-rank-collect-hkdy-1',
  '30 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '한국 단열', 'half', 1),
    -- net.http_post 기본 timeout_milliseconds가 1000(1초)이라, 함수가 130초짜리 예산으로
    -- 도는데 응답을 기다리다 바로 포기해버려 net._http_response에 결과가 안 남는다
    -- (실제 수집 자체는 서버에서 계속 진행됨 — 그냥 응답 확인만 안 되는 것). 함수 예산보다
    -- 넉넉하게 잡아서 응답이 제대로 기록되게 한다.
    timeout_milliseconds := 145000
  );
  $$
);

-- 매일 KST 06:35 (UTC 21:35) — 한국 단열 나머지 절반(2/2). 1번 잡과 5분 간격이라 서로 안 겹친다.
select cron.schedule(
  'daily-rank-collect-hkdy-2',
  '35 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/naver-rank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj',
      'apikey', 'sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj'
    ),
    body := jsonb_build_object('action', 'collectStoreKeywords', 'storeName', '한국 단열', 'half', 2),
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

-- 등록 확인 (jobname 3개, schedule이 다 보이면 성공)
select jobid, jobname, schedule, active from cron.job
where jobname in ('daily-rank-collect-hkdy-1', 'daily-rank-collect-hkdy-2', 'daily-rank-collect-energuard');

-- 참고:
--   실행 이력 확인:   select * from cron.job_run_details where jobid in (
--                       select jobid from cron.job where jobname like 'daily-rank-collect-%'
--                     ) order by start_time desc limit 20;
--   실제 응답/미수집 확인 (timeout_milliseconds 적용 이후 실행분부터 정상 기록됨):
--     select r.created, r.status_code,
--            r.content::jsonb ->> 'storeName' as 스토어,
--            r.content::jsonb ->> 'half' as 분할,
--            (r.content::jsonb ->> 'keywords')::int as 배정된키워드,
--            (r.content::jsonb ->> 'keywordsDone')::int as 처리한키워드,
--            r.content::jsonb -> 'errors' as 실패한키워드_사유
--     from net._http_response r
--     where r.created > now() - interval '7 days'
--     order by r.created desc limit 30;
--   ⚠ 2026-07-30부터: 키워드 순서가 "가장 오래 전에 수집된 것부터" 매일 회전하도록 바뀌었고
--     (collectStoreKeywords), 개별 키워드 실패 시 같은 실행 안에서 1회 재시도한 뒤에도 실패하면
--     위 errors 필드에 사유가 남는다 — 예전엔 조용히 건너뛰기만 해서 원인을 알 방법이 없었다.
--   중단하려면:       select cron.unschedule('daily-rank-collect-hkdy-1');
--                     select cron.unschedule('daily-rank-collect-hkdy-2');
--                     select cron.unschedule('daily-rank-collect-energuard');
--   시간 변경:      이 파일의 '30 21 * * *' / '35 21 * * *'(UTC 기준)를 바꿔 전체 재실행
