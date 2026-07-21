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

drop policy if exists "content drafts anon read" on public.content_drafts;
create policy "content drafts anon read"
on public.content_drafts for select
to anon
using (true);
