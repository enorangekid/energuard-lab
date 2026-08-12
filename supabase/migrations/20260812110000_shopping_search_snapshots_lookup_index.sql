-- Keeps the extension's product-code lookup from scanning the full snapshot table.
create index if not exists idx_shopping_search_snapshots_store_naverid
  on public.shopping_search_snapshots (store_name, collected_date desc)
  where product_code <> '' and naver_product_id <> '';
