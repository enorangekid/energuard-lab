-- 업무노트(admin/work-notes.html) — Admin_backup notes.js 이식.
-- 다른 테이블들과 달리 anon 오픈이 아니라 authenticated 전용 RLS로 잠근다.
-- 이유: 에너가드랩은 사내에 공개될 예정이지만 업무노트는 다른 직원에게 보이면 안 됨.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

create table if not exists public.work_notes (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('general', 'blog', 'youtube')),
  date          date not null,
  title         text,
  content       text,
  status        text not null default 'saving' check (status in ('saving', 'uploaded')),
  ai_suggestion text,
  deleted_at    timestamptz,
  saved_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists work_notes_type_date_idx on public.work_notes (type, date);
create index if not exists work_notes_saved_at_idx on public.work_notes (saved_at desc);

alter table public.work_notes enable row level security;

-- ★ anon에는 정책을 아예 만들지 않는다 = 로그인 안 하면 기본 거부.
do $$
begin
  create policy "work_notes_authenticated_all" on public.work_notes
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 이미지 업로드용 버킷. 파일명이 랜덤 UUID라 URL을 모르면 못 찾지만,
-- 업로드(insert) 자체는 로그인한 사람만 가능하게 막는다.
insert into storage.buckets (id, name, public)
values ('admin-images', 'admin-images', true)
on conflict (id) do nothing;

do $$
begin
  create policy "admin_images_select" on storage.objects
    for select to public using (bucket_id = 'admin-images');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_images_insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'admin-images');
exception when duplicate_object then null;
end $$;
