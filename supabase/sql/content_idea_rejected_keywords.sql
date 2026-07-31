-- 아이템 발굴 "완전삭제(휴지통 비우기)" 시 키워드를 영구 차단 목록에 기록해서, 나중에 같은
-- 키워드가 트렌드/뉴스에 다시 뜨더라도 다시는 후보로 추천되지 않게 한다.
-- (content_ideas 행을 아예 지워버리면 "이미 판단했었다"는 기록이 사라져서, 시간이 지난 뒤
-- 같은 키워드가 처음 보는 것처럼 다시 추천되는 문제가 있었다 — 이 테이블이 그 기록을 대신 남긴다.)
-- Supabase 대시보드 SQL Editor에서 실행하세요.

create table if not exists public.content_idea_rejected_keywords (
  keyword_key text primary key,
  keyword text not null,
  rejected_at timestamptz not null default now()
);

alter table public.content_idea_rejected_keywords enable row level security;

do $$
begin
  create policy "content_idea_rejected_keywords_all" on public.content_idea_rejected_keywords
    for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;
