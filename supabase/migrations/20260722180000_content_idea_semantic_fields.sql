alter table public.content_ideas
  add column if not exists trend_score numeric not null default 0,
  add column if not exists content_angle text not null default '',
  add column if not exists selection_reason text not null default '';
