-- 고객현황 리포트("통계_고객현황_YYYYMM_YYYYMM.csv")의 관심고객수/알림고객수 월별 스냅샷.
-- naver_customer_snapshot(신규/재구매, 성/연령별)과는 완전히 다른 리포트라 별도 테이블로 둔다.
-- period_from/period_to는 "기준일"(예: 2026.06)을 그 달의 1일~말일로 정규화해서 저장 —
-- 기존 고객분석 화면의 월별 기간 선택(customerPeriods)과 그대로 맞아떨어지게 하기 위함이다.
create table if not exists public.naver_customer_interest_monthly (
  period_from date not null,
  period_to date not null,
  interest_new bigint not null default 0,   -- 관심고객수(증감)
  interest_total bigint not null default 0, -- 관심고객수(누적)
  notify_new bigint not null default 0,     -- 알림고객수(증감)
  notify_total bigint not null default 0,   -- 알림고객수(누적)
  fetched_at timestamptz not null default now(),
  primary key (period_from, period_to)
);
alter table public.naver_customer_interest_monthly enable row level security;
