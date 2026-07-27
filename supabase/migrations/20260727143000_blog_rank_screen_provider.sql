alter table public.blog_rank_history
  drop constraint if exists blog_rank_history_provider_check;

alter table public.blog_rank_history
  add constraint blog_rank_history_provider_check
  check (provider in ('naver_blog_screen', 'naver_blog_api', 'serpapi_nexearch'));

comment on column public.blog_rank_history.provider is
  'Rank source: naver_blog_screen is the actual Naver Blog tab screen collector; naver_blog_api is the official Blog Search API. serpapi_nexearch is kept for historical rows only.';
