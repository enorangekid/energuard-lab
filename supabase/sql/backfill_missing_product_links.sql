-- 초기 수집일(07/06~07/07)에 product_link가 비어있던 행들을 링크를 채운다.
-- Supabase 대시보드 SQL Editor에서 그대로 실행하세요. (1회성 정리 — idempotent)

-- 1) 같은 product_code의 다른 행(링크 있는 것)에서 채우기
update public.keyword_rank_history t
set product_link = src.product_link
from (
  select distinct on (product_code) product_code, product_link
  from public.keyword_rank_history
  where product_link <> '' and product_code <> ''
  order by product_code, collected_date desc
) src
where t.product_code = src.product_code
  and (t.product_link is null or t.product_link = '')
  and t.product_code <> '';

-- 2) 1)로도 못 채운 행은 같은 product_name을 쓰는 다른 행(링크 있는 것)에서 채운다.
--    (당시 가격비교 코드 문제로 그 코드 자체는 그날 하루뿐이라 링크가 없었지만,
--     같은 실제 상품이 이후 올바른 코드로 계속 수집되면서 이름은 그대로라 이름으로 매칭 가능)
update public.keyword_rank_history t
set product_link = src.product_link
from (
  select distinct on (product_name) product_name, product_link
  from public.keyword_rank_history
  where product_link <> '' and product_name <> ''
  order by product_name, collected_date desc
) src
where t.product_name = src.product_name
  and (t.product_link is null or t.product_link = '')
  and t.product_name <> '';
