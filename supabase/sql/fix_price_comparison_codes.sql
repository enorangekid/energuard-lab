-- 네이버쇼핑 API가 가격비교(통합) ID를 productId로 돌려줄 때가 있어, 실제 스마트스토어
-- 상품코드(product_link의 /products/{id})와 저장된 product_code가 다른 행이 다수 쌓여 있었다.
-- (엣지펑션은 이미 고쳐서 앞으로는 안 생기지만, 과거 저장분은 남아있다.)
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요. (1회성 정리 — idempotent)

-- 1) 링크의 진짜 코드로 이미 같은 store+keyword+date 행이 있으면, 잘못된 코드 쪽(중복)을 삭제
delete from public.keyword_rank_history t
using public.keyword_rank_history t2
where t.product_link ~ '/products/(\d+)'
  and t.product_code <> substring(t.product_link from '/products/(\d+)')
  and t2.store_name = t.store_name
  and t2.keyword = t.keyword
  and t2.collected_date = t.collected_date
  and t2.product_code = substring(t.product_link from '/products/(\d+)')
  and t2.id <> t.id;

-- 2) 남은(충돌 없는) 잘못된 코드 행은 링크의 진짜 코드로 이전
update public.keyword_rank_history
set product_code = substring(product_link from '/products/(\d+)')
where product_link ~ '/products/(\d+)'
  and product_code <> substring(product_link from '/products/(\d+)');
