alter table public.keyword_rank_history add column if not exists product_price integer;
alter table public.keyword_rank_history alter column product_price set default 0;
update public.keyword_rank_history set product_price = 0 where product_price is null;
alter table public.keyword_rank_history alter column product_price set not null;
