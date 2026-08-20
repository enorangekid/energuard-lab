create table if not exists public.edge_function_daily_usage (
  usage_date date not null default (timezone('Asia/Seoul', now()))::date,
  principal text not null,
  function_name text not null,
  action text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, principal, function_name, action)
);

alter table public.edge_function_daily_usage enable row level security;
revoke all on table public.edge_function_daily_usage from public, anon, authenticated;

create or replace function public.consume_edge_function_quota(
  p_principal text,
  p_function_name text,
  p_action text,
  p_units integer,
  p_daily_limit integer
)
returns table (allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (timezone('Asia/Seoul', now()))::date;
  v_used integer;
begin
  if coalesce(trim(p_principal), '') = ''
    or coalesce(trim(p_function_name), '') = ''
    or coalesce(trim(p_action), '') = ''
    or p_units <= 0
    or p_daily_limit <= 0 then
    raise exception 'invalid quota parameters';
  end if;

  if p_units <= p_daily_limit then
    insert into public.edge_function_daily_usage (
      usage_date, principal, function_name, action, used, updated_at
    ) values (
      v_date, p_principal, p_function_name, p_action, p_units, now()
    )
    on conflict (usage_date, principal, function_name, action)
    do update set
      used = edge_function_daily_usage.used + excluded.used,
      updated_at = now()
    where edge_function_daily_usage.used + excluded.used <= p_daily_limit
    returning edge_function_daily_usage.used into v_used;
  end if;

  if v_used is not null then
    return query select true, v_used, greatest(p_daily_limit - v_used, 0);
    return;
  end if;

  select u.used into v_used
  from public.edge_function_daily_usage u
  where u.usage_date = v_date
    and u.principal = p_principal
    and u.function_name = p_function_name
    and u.action = p_action;

  v_used := coalesce(v_used, 0);
  return query select false, v_used, greatest(p_daily_limit - v_used, 0);
end;
$$;

revoke all on function public.consume_edge_function_quota(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_function_quota(text, text, text, integer, integer)
  to service_role;
