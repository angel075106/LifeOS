-- LifeOS row level security and privileges
--
-- Two independent layers protect every table:
--   1. GRANTs decide which API roles may touch a table (and which columns they may update).
--      Since 2026, new Supabase projects no longer expose new tables automatically, so the
--      grants are explicit. anon gets nothing: every LifeOS table requires a signed-in user.
--   2. RLS policies decide which rows a signed-in user can see or change: only their own.
-- The publishable (anon) key is public by design; these policies are what protect the data.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.activity_categories enable row level security;
alter table public.activities enable row level security;
alter table public.finance_categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: read and update your own row. Rows are created by the signup trigger, and
-- removed by the auth.users cascade, so there are no INSERT or DELETE policies.
-- ---------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Owner-only CRUD for the remaining tables
-- ---------------------------------------------------------------------------
create policy "activity_categories_select_own" on public.activity_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activity_categories_insert_own" on public.activity_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activity_categories_update_own" on public.activity_categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "activity_categories_delete_own" on public.activity_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "activities_select_own" on public.activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activities_insert_own" on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activities_update_own" on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "activities_delete_own" on public.activities
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "finance_categories_select_own" on public.finance_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_categories_insert_own" on public.finance_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_categories_update_own" on public.finance_categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "finance_categories_delete_own" on public.finance_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_select_own" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "budgets_select_own" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Start from nothing (older projects auto-granted ALL to anon and authenticated).
revoke all on table
  public.profiles,
  public.activity_categories,
  public.activities,
  public.finance_categories,
  public.transactions,
  public.budgets
from anon, authenticated;

-- UPDATE is granted per column: ids, owners and timestamps are never client-writable,
-- and a finance category's kind is fixed once created.
grant select on public.profiles to authenticated;
grant update (display_name, currency, timezone, default_calendar_view, week_starts_on)
  on public.profiles to authenticated;

grant select, insert, delete on public.activity_categories to authenticated;
grant update (name, color, is_archived, sort_order) on public.activity_categories to authenticated;

grant select, insert, delete on public.activities to authenticated;
grant update (category_id, title, notes, start_at, end_at, status) on public.activities to authenticated;

grant select, insert, delete on public.finance_categories to authenticated;
grant update (name, color, is_archived, sort_order) on public.finance_categories to authenticated;

grant select, insert, delete on public.transactions to authenticated;
grant update (type, amount_minor, currency, occurred_on, category_id, description)
  on public.transactions to authenticated;

grant select, insert, delete on public.budgets to authenticated;
grant update (amount_minor) on public.budgets to authenticated;

-- service_role bypasses RLS by design; it is never used by the LifeOS app itself.
grant select, insert, update, delete on table
  public.profiles,
  public.activity_categories,
  public.activities,
  public.finance_categories,
  public.transactions,
  public.budgets
to service_role;
