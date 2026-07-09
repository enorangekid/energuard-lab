-- naver-rank Edge Function이 사용하는 월별 검색량 스냅샷 테이블.
-- 네이버 키워드도구는 "최근 1개월" 롤링 값만 주므로(과거 특정 월 조회 불가),
-- 검색할 때마다(또는 월 1회 배치로) 그 시점의 값을 "이번 달" 대표값으로 저장해 쌓아둔다.
-- 같은 달에 여러 번 저장되면 최신값으로 덮어쓴다(on_conflict).
create table if not exists public.keyword_search_volume_monthly (
  keyword text not null,
  snapshot_month text not null,   -- "2026-07" (KST 기준)
  pc bigint not null default 0,
  mobile bigint not null default 0,
  total bigint not null default 0,
  captured_at timestamptz not null default now(),
  primary key (keyword, snapshot_month)
);
alter table public.keyword_search_volume_monthly enable row level security;

create index if not exists keyword_search_volume_monthly_keyword_idx
  on public.keyword_search_volume_monthly(keyword, snapshot_month desc);
