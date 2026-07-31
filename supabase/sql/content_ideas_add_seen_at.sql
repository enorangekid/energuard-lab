-- 아이템 발굴 "NEW" 배지를 localStorage 대신 DB로 관리하기 위한 컬럼 추가.
-- 기존엔 브라우저 localStorage(energContentIdeasSeen:v1)에 "확인한 id 목록"을 저장했는데,
-- 브라우저/프로필이 바뀌거나 Live Server 포트가 바뀌어 origin이 달라지면(로컬스토리지는
-- origin별로 완전히 분리된 저장공간) "처음 방문"으로 오인식해서 그 순간 화면에 떠 있던
-- 항목 전부를 한꺼번에 "확인함" 처리해버리는 문제가 있었다. seen_at을 DB 컬럼으로 옮기면
-- 브라우저가 바뀌어도 유지된다.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

alter table public.content_ideas
  add column if not exists seen_at timestamptz;

-- 참고: 기존에 이미 "확인했던" 항목들은 이 마이그레이션만으로는 알 수 없다(예전엔
-- localStorage에만 있었으니까) — 실행 직후엔 전부 "NEW"로 보일 수 있다. 한 번씩 확인하면
-- 정상적으로 seen_at이 채워지고, 그 뒤로는 이 문제가 재발하지 않는다.
