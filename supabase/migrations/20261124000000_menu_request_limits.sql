-- The counter is not a training history. A request consumes quota before calling Gemini,
-- including upstream failures, so retries cannot bypass the budget. Day boundary: JST.
create table public.menu_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  request_count integer not null check (request_count between 1 and 10),
  primary key (user_id, day)
);
alter table public.menu_request_limits enable row level security;
revoke all on public.menu_request_limits from anon, authenticated;

create function public.consume_menu_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  inserted integer;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.menu_request_limits as limits (user_id, day, request_count)
  values (caller, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (user_id, day) do update
    set request_count = limits.request_count + 1
    where limits.request_count < 10
  returning request_count into inserted;
  return inserted is not null;
end;
$$;
revoke all on function public.consume_menu_request() from public, anon;
grant execute on function public.consume_menu_request() to authenticated;
