-- product_rankings에 "그룹상품(대체 상품코드)" 정보 추가
-- 네이버 그룹상품은 여러 상품코드가 하나로 묶여 있고, 그중 대표로 노출되는 코드가
-- 수시로 바뀐다. alt_codes에 그 그룹의 나머지 코드를 넣어두면, 랭킹추적에서 대표 코드가
-- 바뀌어도(예: A → B) 같은 상품 카드로 계속 이어서 인식한다 (기존 code 컬럼 값이 대표/기준 코드).
-- Supabase 대시보드 SQL Editor에서 그대로 실행하세요. (idempotent)

alter table public.product_rankings add column if not exists alt_codes text[] not null default '{}';
alter table public.product_rankings add column if not exists group_product_no text;

create index if not exists product_rankings_alt_codes_gin_idx
  on public.product_rankings using gin (alt_codes);
