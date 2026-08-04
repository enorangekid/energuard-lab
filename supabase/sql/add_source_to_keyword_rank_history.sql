-- 메인/보조 키워드 직접크롤링(curated)과 네이버 스마트스토어 검색순위진단 스크래핑(naver_diagnosis)이
-- 같은 테이블을 같이 쓰게 되면서, 둘을 구분하고 서로의 데이터를 안 건드리게 하기 위한 컬럼.
alter table public.keyword_rank_history add column if not exists source text;
update public.keyword_rank_history set source = 'curated' where source is null;
alter table public.keyword_rank_history alter column source set default 'curated';
alter table public.keyword_rank_history alter column source set not null;

-- 같은 스토어+키워드+상품+날짜라도 source가 다르면 별도 행으로 유지한다
-- (두 방식이 계산한 순위가 다를 수 있어 서로 덮어쓰면 안 됨).
drop index if exists public.keyword_rank_history_daily_uidx;
create unique index if not exists keyword_rank_history_daily_uidx
  on public.keyword_rank_history (store_name, keyword, product_code, collected_date, source);
