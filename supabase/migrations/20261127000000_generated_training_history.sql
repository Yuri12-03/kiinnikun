-- Training is defined by successful menu generation, using the selected parts.
create table public.generated_training_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  body_parts text[] not null check (
    cardinality(body_parts) between 1 and 6
    and array_position(body_parts, null) is null
    and body_parts <@ array['chest', 'back', 'shoulders', 'arms', 'core', 'legs']::text[]
  )
);
create index generated_training_history_user_time on public.generated_training_history (user_id, generated_at desc);
alter table public.generated_training_history enable row level security;
revoke all on public.generated_training_history from anon, authenticated;
grant select on public.generated_training_history to authenticated;
-- Timestamps and ownership come from the server, never from the mobile clock.
grant insert (body_parts) on public.generated_training_history to authenticated;
create policy "Read own generated training" on public.generated_training_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Record own generated training" on public.generated_training_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function public.get_training_history()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'serverNow', statement_timestamp(),
    'lastGeneratedAt', coalesce((
      select jsonb_object_agg(body_part, last_generated_at)
      from (
        select part.body_part, max(history.generated_at) as last_generated_at
        from public.generated_training_history history
        cross join lateral unnest(history.body_parts) as part(body_part)
        where history.user_id = (select auth.uid())
        group by part.body_part
      ) latest
    ), '{}'::jsonb)
  );
$$;
revoke all on function public.get_training_history() from public, anon;
grant execute on function public.get_training_history() to authenticated;
