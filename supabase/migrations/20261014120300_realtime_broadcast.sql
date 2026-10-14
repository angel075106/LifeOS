-- LifeOS: live cross-device sync via Supabase Realtime Broadcast
--
-- Every write to a user-owned table broadcasts a tiny notification on the private topic
-- "user:<owner uuid>". The payload carries only the table name and operation - never row
-- data - and clients react by re-fetching through the RLS-protected API. A policy on
-- realtime.messages lets each user subscribe to their own topic only.
--
-- Broadcasting is best-effort: if Realtime is unavailable, the write still succeeds and the
-- app falls back to refreshing on focus/reconnect.

create or replace function private.broadcast_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_owner text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  -- tg_argv[0] names the owner column ('user_id', or 'id' for profiles).
  v_owner := v_row ->> tg_argv[0];
  if v_owner is null then
    return null;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'op', lower(tg_op)),
      'db_change',
      'user:' || v_owner,
      true
    );
  exception when others then
    raise warning 'lifeos: realtime broadcast skipped (sqlstate %)', sqlstate;
  end;

  return null;
end;
$$;

revoke all on function private.broadcast_owner_change() from public;

create trigger broadcast_changes after insert or update or delete on public.profiles
  for each row execute function private.broadcast_owner_change('id');
create trigger broadcast_changes after insert or update or delete on public.activity_categories
  for each row execute function private.broadcast_owner_change('user_id');
create trigger broadcast_changes after insert or update or delete on public.activities
  for each row execute function private.broadcast_owner_change('user_id');
create trigger broadcast_changes after insert or update or delete on public.finance_categories
  for each row execute function private.broadcast_owner_change('user_id');
create trigger broadcast_changes after insert or update or delete on public.transactions
  for each row execute function private.broadcast_owner_change('user_id');
create trigger broadcast_changes after insert or update or delete on public.budgets
  for each row execute function private.broadcast_owner_change('user_id');

-- Realtime Authorization: a signed-in user may only receive broadcasts on their own topic.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "lifeos_receive_own_broadcasts" on realtime.messages';
    execute $policy$
      create policy "lifeos_receive_own_broadcasts"
      on realtime.messages
      for select
      to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and (select realtime.topic()) = 'user:' || (select auth.uid())::text
      )
    $policy$;
  else
    raise notice 'realtime.messages not found: skipped the Realtime authorization policy';
  end if;
end
$$;
