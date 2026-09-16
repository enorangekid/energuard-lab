-- 587600188 (USB형 열선커터기 커팅기 교체형 스티로폼 재단기 아이소핑크 재단기) 이름/썸네일 오류 수정
-- 원인: 네이버가 이 상품을 가격비교 통합 카탈로그로 묶으면서, 실제 상품 사진 대신 카탈로그
-- 대표사진(손잡이 그립만 나온 사진, shopping-phinf.pstatic.net/main_1074780/10747805813.11.jpg)을
-- 스캔 결과로 돌려준 적이 있다. rank-tracker.html의 usableProductImage()는 이 URL을 정상 이미지로
-- 오인해 product_rankings 마스터의 올바른 사진보다 항상 우선시했다 (코드 쪽은 이 URL을 블랙리스트
-- 처리해서 앞으로는 무시하도록 고쳤음 — 이 SQL은 마스터 쪽 정답 값을 채워서 그 폴백이 실제로
-- 맞는 사진을 보여주게 한다).
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요. (idempotent)

-- 1) 이미 등록된 행이 있으면(키워드별로 여러 행일 수 있음) 이름/이미지만 갱신
update public.product_rankings
set name = 'USB형 열선커터기 커팅기 교체형 스티로폼 재단기 아이소핑크 재단기',
    image_url = 'https://shop-phinf.pstatic.net/20241210_215/17338085095225lO0d_JPEG/10295885765302132_306002843.jpg?type=o1000'
where code = '587600188';

-- 2) 등록된 행이 아예 없으면 새로 하나 추가 (기타 카테고리)
insert into public.product_rankings (code, keyword, category_tab, image_url, name)
select
  '587600188',
  '열선커터기',
  '기타',
  'https://shop-phinf.pstatic.net/20241210_215/17338085095225lO0d_JPEG/10295885765302132_306002843.jpg?type=o1000',
  'USB형 열선커터기 커팅기 교체형 스티로폼 재단기 아이소핑크 재단기'
where not exists (
  select 1 from public.product_rankings where code = '587600188'
);

-- 확인
select code, keyword, category_tab, name, image_url
from public.product_rankings
where code = '587600188';
