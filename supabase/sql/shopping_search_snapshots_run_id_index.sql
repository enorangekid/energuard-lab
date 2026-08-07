-- report.html이 수집 리포트 조회 시 "canceling statement due to statement timeout"으로 실패하는
-- 문제 수정 (2026-08-07 실측, 11개 키워드 배치 후 리포트 로딩 실패로 발견).
--
-- shopping_search_snapshots가 76,000행 이상으로 커지면서, report.js의 조회 쿼리
--   ?run_id=eq.<uuid>&order=keyword.asc,is_ad.asc,organic_rank.asc
-- 를 뒷받침할 인덱스가 없어 매번 테이블 전체를 훑고 정렬하다가 statement_timeout에 걸렸다.
-- run_id + 정렬 컬럼 3개를 그대로 담은 복합 인덱스를 추가해서, 이 조회가 인덱스만으로
-- 끝나게 한다(정렬까지 인덱스 순서에서 그대로 가져오므로 별도 정렬 비용도 없어진다).
create index if not exists idx_shopping_search_snapshots_run_id_sort
  on public.shopping_search_snapshots (run_id, keyword, is_ad, organic_rank);
