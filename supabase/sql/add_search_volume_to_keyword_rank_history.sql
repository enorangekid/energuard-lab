-- 키워드 일괄 수집 시 함께 받아온 월간 검색량(PC/모바일/합계)을 순위 행에도 denormalize 저장.
-- 랭킹추적(rank-tracker.html)에서 별도 조인 없이 바로 읽을 수 있게 하기 위함.
alter table public.keyword_rank_history add column if not exists search_volume_pc integer;
alter table public.keyword_rank_history add column if not exists search_volume_mobile integer;
alter table public.keyword_rank_history add column if not exists search_volume_total integer;
