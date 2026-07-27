-- tracked_items에 그룹상품 대체 코드를 저장한다.
-- 네이버 그룹상품은 대표 옵션이 다른 상품코드로 바뀔 수 있다.
-- alt_codes에 같은 그룹상품의 다른 옵션 코드를 등록하면,
-- 어떤 코드가 검색에 잡히더라도 기준 product_code 아래로 이력을 모을 수 있다.
-- Supabase SQL Editor에서 반복 실행해도 안전하다.

alter table public.tracked_items
  add column if not exists alt_codes jsonb not null default '[]'::jsonb;
