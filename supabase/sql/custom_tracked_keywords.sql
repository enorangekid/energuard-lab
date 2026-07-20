-- 키워드 일괄 수집(naver-rank.html)에서 사용자가 직접 추가하는 "커스텀 키워드" 테이블
-- Supabase 대시보드 SQL Editor에서 위에서 아래로 그대로 실행하세요. (idempotent)
--
-- 기존에는 브라우저 localStorage에만 저장돼서 cron(서버)이 알 수 없었다 — 이 테이블로
-- 옮겨서 naver-rank.html(추가/삭제)과 naver-rank 함수의 collectStoreKeywords 액션(cron 수집)이
-- 같은 목록을 보게 한다. 기본 키워드 트리(KW_TREE/STORE_BATCH_KEYWORDS)는 변경이 드물고
-- Claude가 코드로 수정하므로 그대로 코드에 둔다 — 여기 옮기는 건 "런타임에 늘어나는" 커스텀 키워드만.

create table if not exists public.custom_tracked_keywords (
  keyword text primary key,
  main_keyword text not null default '',
  is_sub boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS + 정책 (프론트에서 anon 키로 직접 CRUD — keyword_rank_history/tracked_items와 동일한 신뢰 모델)
alter table public.custom_tracked_keywords enable row level security;

drop policy if exists "custom_tracked_keywords_all" on public.custom_tracked_keywords;
create policy "custom_tracked_keywords_all" on public.custom_tracked_keywords
  for all to anon using (true) with check (true);
