alter table public.keyword_rank_history add column if not exists product_link text;
alter table public.keyword_rank_history alter column product_link set default '';
update public.keyword_rank_history set product_link = '' where product_link is null;
alter table public.keyword_rank_history alter column product_link set not null;
