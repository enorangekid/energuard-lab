-- background.js의 fetchCollectionContext()가 naver_product_id -> product_code 역추적용으로 쓰는
-- 쿼리(store_name=eq.X & product_code<>'' & naver_product_id<>'' & order by collected_date desc)가
-- "한국 단열" 스토어에서 statement timeout(57014)으로 실패하는 문제(2026-08-12 실측)를 고친다.
-- naver_product_id는 이 테이블 행의 사실상 전부(102,875/102,875)에 채워져 있어 필터로 거의
-- 걸러주지 못하고, product_code<>''만 실제로 선택적이다(59,647/102,875) — 쿼리와 정확히 같은
-- WHERE 조건의 partial index로 그 부분집합만 미리 store_name+collected_date desc로 정렬해둔다.
create index if not exists idx_shopping_search_snapshots_store_naverid
  on public.shopping_search_snapshots (store_name, collected_date desc)
  where product_code <> '' and naver_product_id <> '';
