-- LifeOS row-level-security verification
--
-- Run in Supabase Dashboard -> SQL Editor (paste the whole file, then Run).
-- It creates two throwaway users inside a transaction, checks that neither can read or change
-- the other's data through the API roles, and then ROLLS EVERYTHING BACK.
--
-- Result: "Success. No rows returned" means every check passed.
-- Any problem stops the script with an error message starting with "FAIL:".

begin;

-- Two throwaway auth users. The signup trigger seeds their profiles and default categories.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'rls-check-a@lifeos.invalid', '{"timezone":"Europe/Sofia"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2b2b2b2-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'rls-check-b@lifeos.invalid', '{}', now(), now());

-- ---------------------------------------------------------------------------------------
-- As user A: create an activity and a transaction.
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_activity_category uuid;
  v_expense_category uuid;
begin
  select id into v_activity_category from public.activity_categories order by sort_order limit 1;
  select id into v_expense_category from public.finance_categories where kind = 'expense' order by sort_order limit 1;
  if v_activity_category is null or v_expense_category is null then
    raise exception 'FAIL: the signup trigger did not create default categories for user A';
  end if;

  insert into public.activities (user_id, category_id, title, start_at, end_at)
  values ('a1a1a1a1-0000-4000-8000-00000000000a', v_activity_category, 'rls-check activity',
          '2026-10-14T07:00:00Z', '2026-10-14T08:00:00Z');
  insert into public.transactions (user_id, type, amount_minor, currency, occurred_on, category_id, description)
  values ('a1a1a1a1-0000-4000-8000-00000000000a', 'expense', 1234, 'EUR', '2026-10-14', v_expense_category,
          'rls-check transaction');

  -- Positive control: the owner sees their own rows (so the checks below are meaningful).
  if (select count(*) from public.activities where title = 'rls-check activity') <> 1 then
    raise exception 'FAIL: user A cannot read their own activity';
  end if;
end
$$;

reset role;

-- One of user A's category ids, looked up as the table owner, for the checks below.
select set_config(
  'lifeos.a_category',
  (select id::text from public.activity_categories
    where user_id = 'a1a1a1a1-0000-4000-8000-00000000000a' order by sort_order limit 1),
  true
);

-- ---------------------------------------------------------------------------------------
-- As user B: try to read, change, delete, forge and borrow user A's data.
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_rows integer;
begin
  if (select count(*) from public.activities where title = 'rls-check activity') <> 0 then
    raise exception 'FAIL: user B can read user A''s activities';
  end if;
  if (select count(*) from public.transactions where description = 'rls-check transaction') <> 0 then
    raise exception 'FAIL: user B can read user A''s transactions';
  end if;
  if (select count(*) from public.profiles where id = 'a1a1a1a1-0000-4000-8000-00000000000a') <> 0 then
    raise exception 'FAIL: user B can read user A''s profile';
  end if;

  update public.activities set title = 'hijacked' where title = 'rls-check activity';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FAIL: user B updated user A''s activity'; end if;

  delete from public.transactions where description = 'rls-check transaction';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FAIL: user B deleted user A''s transaction'; end if;

  begin
    -- Owned by A with A's own category: only the RLS insert policy can stop this.
    insert into public.activities (user_id, category_id, title, start_at, end_at)
    values ('a1a1a1a1-0000-4000-8000-00000000000a', current_setting('lifeos.a_category')::uuid, 'forged',
            '2026-10-14T09:00:00Z', '2026-10-14T10:00:00Z');
    raise exception 'FAIL: user B inserted a row owned by user A';
  exception when insufficient_privilege then
    null; -- expected: rejected by the RLS insert policy
  end;

  -- Positive control: B sees only their own (seeded) categories.
  if (select count(*) from public.activity_categories) = 0 then
    raise exception 'FAIL: user B has no default categories';
  end if;
end
$$;

reset role;

-- Composite ownership FK: B cannot reference A's category even when the id is known.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"b2b2b2b2-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into public.activities (user_id, category_id, title, start_at, end_at)
    values ('b2b2b2b2-0000-4000-8000-00000000000b', current_setting('lifeos.a_category')::uuid, 'borrowed category',
            '2026-10-14T09:00:00Z', '2026-10-14T10:00:00Z');
    raise exception 'FAIL: user B attached an activity to user A''s category';
  exception when foreign_key_violation then
    null; -- expected: the composite (category_id, user_id) foreign key rejects it
  end;
  reset role;
end
$$;

-- Anonymous API role: no access to any LifeOS table.
set local role anon;
do $$
begin
  begin
    perform 1 from public.activities limit 1;
    raise exception 'FAIL: the anon role can query activities';
  exception when insufficient_privilege then
    null; -- expected: no grants for anon
  end;
end
$$;
reset role;

rollback;
