-- The Admin hub and Energuard Lab now share one Supabase Auth session.
-- Keep existing anon policies for the browser extension, while ensuring that
-- the signed-in web apps can continue to use every existing public table.
do $$
declare
  table_row record;
begin
  for table_row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'grant select, insert, update, delete on table %I.%I to authenticated',
      table_row.schemaname,
      table_row.tablename
    );

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = table_row.schemaname
        and c.relname = table_row.tablename
        and c.relrowsecurity
    ) then
      execute format(
        'drop policy if exists energeguard_authenticated_all on %I.%I',
        table_row.schemaname,
        table_row.tablename
      );
      execute format(
        'create policy energeguard_authenticated_all on %I.%I for all to authenticated using (true) with check (true)',
        table_row.schemaname,
        table_row.tablename
      );
    end if;
  end loop;
end
$$;

grant usage, select on all sequences in schema public to authenticated;
