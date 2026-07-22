create extension if not exists pgcrypto with schema extensions;

create table if not exists public.realtime_trend_archive (
  id uuid primary key default extensions.gen_random_uuid(),
  slot text not null,
  list_type text not null,
  rank int not null,
  keyword text not null,
  sources text not null default '',
  captured_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot, list_type, keyword)
);

create index if not exists realtime_trend_archive_active_idx
  on public.realtime_trend_archive (list_type, deleted_at, slot desc, rank asc);

alter table public.realtime_trend_archive enable row level security;
