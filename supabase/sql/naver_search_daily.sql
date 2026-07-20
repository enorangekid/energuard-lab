-- 네이버 검색분석(비즈어드바이저 "검색어" 엑셀) 저장용 테이블
-- Supabase 대시보드 SQL Editor에서 그대로 실행하세요. (idempotent)
--
-- naver_product_daily/naver_visit_daily와 동일한 신뢰 모델: RLS는 켜두고 anon 정책은 안 만든다 —
-- 읽기/쓰기 전부 naver-ad-report Edge Function(service-role 키)을 통해서만 이뤄진다.

create table if not exists public.naver_search_daily (
  report_date date not null,
  term text not null default '',        -- "전체" = 그날 검색 유입 합계, 그 외 = 개별 검색어
  visits bigint not null default 0,
  pay_count bigint not null default 0,
  conversion numeric not null default 0,
  sales_total numeric not null default 0,
  avg_order numeric not null default 0,  -- 상품결제단가
  fetched_at timestamptz not null default now(),
  primary key (report_date, term)
);

alter table public.naver_search_daily enable row level security;
