-- naver_customer_snapshot에 dimension(구분축) 컬럼을 추가한다.
-- 기존에는 기간(period_from~period_to)마다 segment(전체합산/신규/재구매) 축 하나만 저장했는데,
-- 성별+연령대(고객분류: "남성 20대"/"여성 30대" 등) 데이터도 같은 기간에 같이 저장하려면
-- 두 축을 구분해야 업로드할 때 서로 덮어쓰지 않는다.
-- 'ltv' = 기존 신규/재구매 축(기본값, 기존 행에도 자동 적용됨), 'gender_age' = 성별+연령대 축.
alter table public.naver_customer_snapshot
  add column if not exists dimension text not null default 'ltv';

alter table public.naver_customer_snapshot drop constraint if exists naver_customer_snapshot_pkey;
alter table public.naver_customer_snapshot
  add primary key (period_from, period_to, dimension, segment);
