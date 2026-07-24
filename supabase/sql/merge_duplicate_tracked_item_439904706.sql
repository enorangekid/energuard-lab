-- 세경 아이소핑크(특호 30T 900x1800 -1장) 중복 등록 정리
-- 원인: 네이버가 이 상품을 스마트스토어 직접링크 대신 가격비교 통합 카탈로그 링크로 돌려준 적이
-- 있어, 아이템추적 쪽은 그때 캐치된 네이버 내부 productId(11097629335)로 등록됐고,
-- 랭킹추적 쪽은 스마트스토어 자체 상품번호(439904706)로 따로 등록됐다.
-- 두 코드가 같이 tracked_items에 있으면 매칭 로직(apiId 우선)이 항상 11097629335만 골라서
-- 439904706 쪽은 스캔이 성공해도 절대 매칭될 수 없었다. 439904706 하나로 합친다.
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요. (idempotent)

-- 1) 439904706(아직 미수집)에 11097629335 쪽의 이미 수집된 상품 정보(이름/이미지/링크/판매처)를 옮긴다
update public.tracked_items t
set product_name = o.product_name,
    product_image = o.product_image,
    product_link = coalesce(nullif(t.product_link, ''), o.product_link),
    mall_name = coalesce(nullif(t.mall_name, ''), o.mall_name),
    updated_at = now()
from public.tracked_items o
where t.product_code = '439904706'
  and o.product_code = '11097629335';

-- 2) 11097629335로 쌓인 순위·가격 이력을 439904706으로 이관 (겹치는 날짜는 버림)
insert into public.tracked_item_history (product_code, keyword, rank, price, mall_name, collected_date, checked_at)
select '439904706', keyword, rank, price, mall_name, collected_date, checked_at
from public.tracked_item_history
where product_code = '11097629335'
on conflict (product_code, keyword, collected_date) do nothing;

delete from public.tracked_item_history where product_code = '11097629335';

-- 3) 중복 등록 삭제
delete from public.tracked_items where product_code = '11097629335';

-- 확인
select product_code, product_name, is_mine, keywords from public.tracked_items where product_code = '439904706';
