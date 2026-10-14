-- LifeOS: new-user bootstrap
--
-- When Supabase Auth creates a user, a trigger creates their profile and default activity
-- and finance categories. The same idempotent routine backfills users who signed up before
-- this migration, and is exposed as bootstrap_current_user() so the app can repair a
-- missing profile for the signed-in user (it can only ever act on auth.uid()).

create or replace function private.seed_user_defaults(p_user_id uuid, p_timezone text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text := 'UTC';
begin
  if p_user_id is null then
    return;
  end if;

  -- The time zone comes from sign-up metadata (user-supplied), so only accept a
  -- well-formed IANA-style name; anything else falls back to UTC.
  if p_timezone is not null
     and char_length(p_timezone) <= 64
     and p_timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}$' then
    v_timezone := p_timezone;
  end if;

  insert into public.profiles (id, timezone)
  values (p_user_id, v_timezone)
  on conflict (id) do nothing;

  -- Defaults are only created for users with no categories yet, so categories a user
  -- deliberately deleted are never resurrected.
  if not exists (select 1 from public.activity_categories where user_id = p_user_id) then
    insert into public.activity_categories (user_id, name, color, sort_order)
    values
      (p_user_id, 'Training', '#f97316', 10),
      (p_user_id, 'Running',  '#84cc16', 20),
      (p_user_id, 'Work',     '#3b82f6', 30),
      (p_user_id, 'Study',    '#a855f7', 40),
      (p_user_id, 'Coding',   '#22d3ee', 50),
      (p_user_id, 'Personal', '#ec4899', 60),
      (p_user_id, 'Sleep',    '#6366f1', 70);
  end if;

  if not exists (select 1 from public.finance_categories where user_id = p_user_id) then
    insert into public.finance_categories (user_id, kind, name, color, sort_order)
    values
      (p_user_id, 'income',  'Salary',        '#22c55e', 10),
      (p_user_id, 'income',  'Freelance',     '#10b981', 20),
      (p_user_id, 'income',  'Gifts',         '#a3e635', 30),
      (p_user_id, 'income',  'Other income',  '#94a3b8', 40),
      (p_user_id, 'expense', 'Housing',       '#6366f1', 10),
      (p_user_id, 'expense', 'Groceries',     '#14b8a6', 20),
      (p_user_id, 'expense', 'Dining',        '#f97316', 30),
      (p_user_id, 'expense', 'Transport',     '#3b82f6', 40),
      (p_user_id, 'expense', 'Utilities',     '#0ea5e9', 50),
      (p_user_id, 'expense', 'Health',        '#ec4899', 60),
      (p_user_id, 'expense', 'Entertainment', '#a855f7', 70),
      (p_user_id, 'expense', 'Shopping',      '#d946ef', 80),
      (p_user_id, 'expense', 'Education',     '#8b5cf6', 90),
      (p_user_id, 'expense', 'Other',         '#94a3b8', 100);
  end if;
end;
$$;

revoke all on function private.seed_user_defaults(uuid, text) from public;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_user_defaults(new.id, new.raw_user_meta_data ->> 'timezone');
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created_lifeos on auth.users;
create trigger on_auth_user_created_lifeos
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Callable by the signed-in user; only ever seeds auth.uid().
create or replace function public.bootstrap_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform private.seed_user_defaults(v_uid, null);
end;
$$;

revoke all on function public.bootstrap_current_user() from public, anon;
grant execute on function public.bootstrap_current_user() to authenticated;

-- Backfill: users created before this migration (for example while testing the starter).
do $$
begin
  perform private.seed_user_defaults(u.id, u.raw_user_meta_data ->> 'timezone')
  from auth.users u;
end
$$;
