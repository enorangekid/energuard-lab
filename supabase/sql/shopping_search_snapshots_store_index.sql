-- 순위 수집 시작 시 "저장 데이터 조회 실패: statement timeout"이 가끔 나는 문제 수정
-- (2026-08-10 실측 — 수집 몇 번 하면 되긴 하는 간헐적 증상으로 확인).
--
-- background.js의 fetchCollectionContext()가 수집을 시작할 때마다
--   /rest/v1/shopping_search_snapshots?store_name=eq.<store>&product_code=neq.&naver_product_id=neq.
--     &order=collected_date.desc
-- 를 매번 조회하는데, 이 테이블이 커지면서(7만 6천 행 이상) 이 조회를 받쳐줄 인덱스가 없어
-- 매번 전체 스캔 후 정렬하다가 statement_timeout에 걸렸다. store_name + 정렬 컬럼을 담은
-- 인덱스를 추가해서 이 조회가 인덱스만으로 끝나게 한다.
create index if not exists idx_shopping_search_snapshots_store_collected
  on public.shopping_search_snapshots (store_name, collected_date desc);
