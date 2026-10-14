-- LifeOS: atomic multi-row operations exposed as RPCs.
--
-- All functions are SECURITY INVOKER: they run as the calling user, so the RLS policies and
-- column grants from the previous migration still apply to every statement inside them.

-- Delete an activity category. Activities that use it must be moved to a replacement first;
-- without a replacement the ownership FK (ON DELETE RESTRICT) rejects deleting a used category.
create or replace function public.delete_activity_category(
  p_category_id uuid,
  p_replacement_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_replacement_id is not null then
    if p_replacement_id = p_category_id then
      raise exception 'Replacement must be a different category' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.activity_categories where id = p_replacement_id and user_id = v_uid
    ) then
      raise exception 'Replacement category not found' using errcode = 'P0002';
    end if;

    update public.activities
       set category_id = p_replacement_id
     where category_id = p_category_id
       and user_id = v_uid;
  end if;

  delete from public.activity_categories where id = p_category_id and user_id = v_uid;
  if not found then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Delete a finance category, optionally moving its transactions to a replacement of the
-- same kind. Budgets of the deleted category are removed by the FK cascade.
create or replace function public.delete_finance_category(
  p_category_id uuid,
  p_replacement_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_replacement_kind text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select kind into v_kind
    from public.finance_categories
   where id = p_category_id and user_id = v_uid;
  if v_kind is null then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;

  if p_replacement_id is not null then
    if p_replacement_id = p_category_id then
      raise exception 'Replacement must be a different category' using errcode = '22023';
    end if;

    select kind into v_replacement_kind
      from public.finance_categories
     where id = p_replacement_id and user_id = v_uid;
    if v_replacement_kind is null then
      raise exception 'Replacement category not found' using errcode = 'P0002';
    end if;
    if v_replacement_kind <> v_kind then
      raise exception 'Replacement must be a category of the same kind' using errcode = '22023';
    end if;

    update public.transactions
       set category_id = p_replacement_id
     where category_id = p_category_id
       and user_id = v_uid;
  end if;

  delete from public.finance_categories where id = p_category_id and user_id = v_uid;
end;
$$;

-- Create or update the budget for (category, month, currency) in one statement.
create or replace function public.upsert_budget(
  p_category_id uuid,
  p_month date,
  p_currency text,
  p_amount_minor bigint
)
returns public.budgets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.budgets;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.budgets (user_id, category_id, month, currency, amount_minor)
  values (v_uid, p_category_id, p_month, p_currency, p_amount_minor)
  on conflict (user_id, category_id, month, currency)
  do update set amount_minor = excluded.amount_minor
  returning * into v_row;

  return v_row;
end;
$$;

-- Copy one month's budgets (for active categories) into another month, keeping any budgets
-- that already exist in the target month. Returns the number of budgets created.
create or replace function public.copy_budgets(p_from_month date, p_to_month date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_from_month = p_to_month then
    return 0;
  end if;

  insert into public.budgets (user_id, category_id, month, currency, amount_minor)
  select b.user_id, b.category_id, p_to_month, b.currency, b.amount_minor
    from public.budgets b
    join public.finance_categories c
      on c.id = b.category_id and c.user_id = b.user_id
   where b.user_id = v_uid
     and b.month = p_from_month
     and not c.is_archived
  on conflict (user_id, category_id, month, currency) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_activity_category(uuid, uuid) from public, anon;
revoke all on function public.delete_finance_category(uuid, uuid) from public, anon;
revoke all on function public.upsert_budget(uuid, date, text, bigint) from public, anon;
revoke all on function public.copy_budgets(date, date) from public, anon;

grant execute on function public.delete_activity_category(uuid, uuid) to authenticated;
grant execute on function public.delete_finance_category(uuid, uuid) to authenticated;
grant execute on function public.upsert_budget(uuid, date, text, bigint) to authenticated;
grant execute on function public.copy_budgets(date, date) to authenticated;
