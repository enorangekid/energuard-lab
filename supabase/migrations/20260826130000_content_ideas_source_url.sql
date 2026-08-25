-- 발굴 키워드가 뉴스 이슈(단열뉴스 등)에서 왔을 때, 원문 기사 링크를 같이 저장해둔다.
-- 나중에 콘텐츠 작성 시 원문이 필요할 때 아이템발굴 카드에서 바로 열어볼 수 있게 하기 위함.
alter table public.content_ideas
  add column if not exists source_url text not null default '';
