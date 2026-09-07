-- 구글급상승 항목이 왜 뜨는지 확인할 수 있는 관련 기사 링크를 저장한다. 구글 트렌드 RSS가
-- newsUrl을 이미 내려주는데 지금까지 화면에 안 넘기고 버리고 있었다 — 실시간통합(여러 소스
-- 종합순위)과 구글급상승(그 화제의 실제 기사로 바로 갈 수 있는 탭)을 차별화하기 위해 추가.
alter table public.realtime_trend_snapshot
  add column if not exists link_url text not null default '';
alter table public.realtime_trend_archive
  add column if not exists link_url text not null default '';
