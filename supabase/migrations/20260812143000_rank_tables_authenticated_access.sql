-- The web app now sends the signed-in user's JWT through auth-guard.js.
-- Keep the existing anon policies temporarily for the Chrome collector, while
-- allowing authenticated Energuard Lab users to read and manage rank data.

grant select, insert, update, delete on table public.keyword_rank_history to authenticated;
grant select, insert, update, delete on table public.product_rankings to authenticated;
grant select, insert, update, delete on table public.tracked_items to authenticated;
grant select, insert, update, delete on table public.tracked_item_history to authenticated;

drop policy if exists "keyword_rank_history_authenticated_all" on public.keyword_rank_history;
create policy "keyword_rank_history_authenticated_all"
  on public.keyword_rank_history
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "product_rankings_authenticated_all" on public.product_rankings;
create policy "product_rankings_authenticated_all"
  on public.product_rankings
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tracked_items_authenticated_all" on public.tracked_items;
create policy "tracked_items_authenticated_all"
  on public.tracked_items
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tracked_item_history_authenticated_all" on public.tracked_item_history;
create policy "tracked_item_history_authenticated_all"
  on public.tracked_item_history
  for all
  to authenticated
  using (true)
  with check (true);
