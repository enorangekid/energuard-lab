-- Energuard Lab is private. Public browser pages and the Chrome extension use
-- the same Supabase Auth session, so the publishable key no longer needs table
-- access of its own.
create or replace function public.is_energuard_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() in (
    'e49b589e-ee29-408a-8f70-0e1d7a357f0f'::uuid,
    'c1b81471-b76d-46ba-bcf5-1fc7a52c9ea7'::uuid
  );
$$;

revoke all on function public.is_energuard_admin() from public, anon;
grant execute on function public.is_energuard_admin() to authenticated, service_role;

do $$
declare
  policy_row record;
  table_row record;
begin
  -- Remove every legacy policy, including policies granted to public. A public
  -- policy also applies to authenticated users and would bypass the allowlist.
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;

  for table_row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', table_row.schemaname, table_row.tablename);
    execute format('revoke all on table %I.%I from anon', table_row.schemaname, table_row.tablename);
    execute format(
      'grant select, insert, update, delete on table %I.%I to authenticated',
      table_row.schemaname,
      table_row.tablename
    );
    execute format(
      'create policy energeguard_admin_all on %I.%I for all to authenticated using (public.is_energuard_admin()) with check (public.is_energuard_admin())',
      table_row.schemaname,
      table_row.tablename
    );
  end loop;
end
$$;

revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated;
