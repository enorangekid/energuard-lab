-- 아이템 추적 데이터 전체 초기화 (tracked_items + tracked_item_history)
-- 이름 기준 중복 감지 기능을 새로 넣으면서, 기존에 코드가 꼬여 쌓인 데이터를 하나씩 정리하는
-- 대신 처음부터 다시 등록해서 수집하기로 함 — 수집 기간이 짧아 데이터 손실 부담이 없음.
-- Supabase 대시보드 SQL Editor에서 실행하세요. 되돌릴 수 없으니 실행 전 한 번 더 확인할 것.
-- (앞서 만든 merge_duplicate_tracked_item_439904706.sql은 이 초기화로 대상 행이 전부
--  사라지므로 이제 실행할 필요 없음 — 실행해도 대상이 없어 아무 일도 안 일어남)

truncate table public.tracked_item_history;
truncate table public.tracked_items;

-- 확인 (둘 다 0이어야 정상)
select
  (select count(*) from public.tracked_items) as tracked_items_count,
  (select count(*) from public.tracked_item_history) as tracked_item_history_count;
