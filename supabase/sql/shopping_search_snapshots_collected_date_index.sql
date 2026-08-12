-- background.js의 cleanupOldSnapshots()가 매 수집 시작마다 collected_date < cutoff 조건만으로
-- 오래된 스냅샷을 정리하는데, 이 컬럼으로 시작하는 인덱스가 없어 전체 테이블(12만 행+)을
-- 스캔하고 있었다(2026-08-12 실측, 삭제 대상 0건인데도 4.3초 소요) - 수집 시작 전 "준비 중"
-- 단계가 계속 느렸던 원인 중 하나.
create index if not exists idx_shopping_search_snapshots_collected_date
  on public.shopping_search_snapshots (collected_date);
