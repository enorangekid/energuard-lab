-- The integrated admin and Energuard Lab are now operated by one account.
-- Keep this as a follow-up migration so the previously applied migration
-- history remains reproducible.
create or replace function public.is_energuard_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'c1b81471-b76d-46ba-bcf5-1fc7a52c9ea7'::uuid;
$$;

revoke all on function public.is_energuard_admin() from public;
grant execute on function public.is_energuard_admin() to authenticated;
