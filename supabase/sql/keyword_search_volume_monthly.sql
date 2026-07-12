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

-- 프론트(anon 키)에서 추이 조회가 가능해야 함 — 다른 테이블과 동일한 신뢰 모델.
-- (정책 없이 RLS만 켜면 anon 조회가 에러 없이 빈 결과만 반환하므로 반드시 필요)
drop policy if exists "keyword_search_volume_monthly_select" on public.keyword_search_volume_monthly;
create policy "keyword_search_volume_monthly_select" on public.keyword_search_volume_monthly
  for select to anon using (true);

-- 과거 월 데이터 백필(판다랭크 등 외부 소스)용 쓰기 정책 — keyword_rank_history와 동일한 신뢰 모델
drop policy if exists "keyword_search_volume_monthly_insert" on public.keyword_search_volume_monthly;
create policy "keyword_search_volume_monthly_insert" on public.keyword_search_volume_monthly
  for insert to anon with check (true);

drop policy if exists "keyword_search_volume_monthly_update" on public.keyword_search_volume_monthly;
create policy "keyword_search_volume_monthly_update" on public.keyword_search_volume_monthly
  for update to anon using (true) with check (true);

create index if not exists keyword_search_volume_monthly_keyword_idx
  on public.keyword_search_volume_monthly(keyword, snapshot_month desc);
