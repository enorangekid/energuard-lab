create table if not exists public.content_ideas (
  id text primary key,
  keyword text not null default '',
  source text not null default 'manual',
  category text not null default '기타',
  product_group text not null default '기타',
  search_volume numeric not null default 0,
  competition_score numeric not null default 0,
  season_score numeric not null default 0,
  ai_score numeric not null default 0,
  status text not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_ideas_category_idx
  on public.content_ideas(category);

create index if not exists content_ideas_status_score_idx
  on public.content_ideas(status, ai_score desc);

create table if not exists public.content_drafts (
  id bigserial primary key,
  idea_id text not null references public.content_ideas(id) on delete cascade,
  keyword text not null default '',
  title text not null default '',
  outline jsonb not null default '[]'::jsonb,
  body text not null default '',
  faq jsonb not null default '[]'::jsonb,
  thumbnail text not null default '',
  ai_notes text not null default '',
  status text not null default 'drafted',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(idea_id)
);

create index if not exists content_drafts_generated_idx
  on public.content_drafts(generated_at desc);

alter table public.content_ideas enable row level security;
alter table public.content_drafts enable row level security;

drop policy if exists "content ideas anon read" on public.content_ideas;
create policy "content ideas anon read"
on public.content_ideas for select
to anon
using (true);

drop policy if exists "content ideas anon update" on public.content_ideas;
create policy "content ideas anon update"
on public.content_ideas for update
to anon
using (true)
with check (true);

drop policy if exists "content drafts anon read" on public.content_drafts;
create policy "content drafts anon read"
on public.content_drafts for select
to anon
using (true);

-- 유튜브 초안 확정(setYoutubeStatus → content_drafts.ai_notes PATCH)이 anon 키로 오는데
-- update 정책이 없어서 조용히 막히고 있었다(에러 없이 0행 갱신 → 새로고침하면 원상복구된 것처럼 보임).
drop policy if exists "content drafts anon update" on public.content_drafts;
create policy "content drafts anon update"
on public.content_drafts for update
to anon
using (true)
with check (true);
