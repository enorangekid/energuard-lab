-- 실시간통합에서 구글 트렌드를 제외하기로 한 결정(2026-09-07) 이후에도, 그 전에 이미 쌓인
-- realtime_trend_archive/realtime_trend_snapshot의 list_type='realtime' 기록엔 구글이 소스로
-- 남아있어서 "실시간" 누적 뷰·최신 슬롯에 구글 항목이 계속 보였다(사용자 지적으로 발견). 이미
-- 저장된 과거 기록을 정리한다: 구글만 소스였던 행은 삭제, 시그널/네이트와 같이 잡혔던 행은
-- sources 배열에서 구글만 제거하고 남긴다.

-- ── realtime_trend_archive ──
update public.realtime_trend_archive
set deleted_at = now(), updated_at = now()
where list_type = 'realtime'
  and deleted_at is null
  and sources ilike '%구글%'
  and sources not ilike '%시그널%'
  and sources not ilike '%네이트%';

update public.realtime_trend_archive
set sources = (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements_text(sources::jsonb) as elem
    where elem <> '구글'
  )::text,
  updated_at = now()
where list_type = 'realtime'
  and deleted_at is null
  and sources ilike '%구글%';

-- ── realtime_trend_snapshot (소프트 삭제 컬럼이 없어 구글 단독 행은 그냥 삭제) ──
delete from public.realtime_trend_snapshot
where list_type = 'realtime'
  and sources ilike '%구글%'
  and sources not ilike '%시그널%'
  and sources not ilike '%네이트%';

update public.realtime_trend_snapshot
set sources = (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements_text(sources::jsonb) as elem
    where elem <> '구글'
  )::text
where list_type = 'realtime'
  and sources ilike '%구글%';
