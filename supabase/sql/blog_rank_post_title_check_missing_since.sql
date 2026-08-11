-- 대시보드 "누락 포스팅" 카드에 체크일이 아니라 실제 누락 시작일을 보여주기 위한 컬럼 추가
-- (2026-08-10 요청). blog_rank_post_title_check는 히스토리 없이 포스팅당 최신 상태만
-- 유지하는 테이블이라(스키마 원 주석), checked_at만으로는 "언제부터 누락됐는지" 알 수 없었다.
--
-- missing_since: found가 true→false로 바뀌는 순간에만 새로 찍히고, 계속 누락 상태면 그대로
-- 유지된다(엣지함수 collectPostTitleCheck 수정, 2026-08-10). found가 다시 true가 되면 비워진다.
alter table public.blog_rank_post_title_check
  add column if not exists missing_since timestamptz;

-- 이미 누락 상태로 저장돼 있던 기존 행은 진짜 누락 시작일을 알 수 없으니, 최소한 확인 가능한
-- 값인 checked_at으로 근사치를 채워둔다(그 이후 재확인부터는 정확한 값으로 유지됨).
update public.blog_rank_post_title_check
  set missing_since = checked_at
  where found = false and missing_since is null;
