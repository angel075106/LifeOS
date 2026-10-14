-- LifeOS core schema
--
-- Conventions
--   * UUID primary keys (gen_random_uuid()).
--   * Every user-owned row carries user_id -> auth.users(id) ON DELETE CASCADE, so deleting
--     an account removes all of its data.
--   * References between user-owned tables include user_id in a composite foreign key. FK
--     checks bypass RLS, so this is what guarantees a row can only point at a parent owned
--     by the same user (for example, an activity can never use another user's category).
--   * Money is stored as bigint minor units (cents) together with an ISO 4217 currency code.
--     Amounts in different currencies are never summed by the database.
--   * Activity times are timestamptz (absolute instants). The app buckets them into local
--     calendar days using profiles.timezone. Transactions carry a plain calendar date
--     (occurred_on), which is already "local" and needs no conversion.
--   * created_at / updated_at are maintained by triggers; clients cannot forge them.
--   * Derived totals (durations, cash flow, budget usage) are computed from these records;
--     nothing stores duplicated totals.

create schema if not exists private;
revoke all on schema private from public;
comment on schema private is 'LifeOS internal helpers. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Shared trigger: server-side timestamps
-- ---------------------------------------------------------------------------
create or replace function private.set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holding preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency text not null default 'EUR',
  timezone text not null default 'UTC',
  default_calendar_view text not null default 'month',
  week_starts_on smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check
    check (display_name is null or (char_length(display_name) between 1 and 80 and display_name = btrim(display_name))),
  constraint profiles_currency_check check (currency in ('EUR', 'BGN')),
  -- IANA zone name shape (e.g. Europe/Sofia, America/Argentina/Buenos_Aires, Etc/GMT+2).
  -- The app validates the name against the runtime's time zone database.
  constraint profiles_timezone_check
    check (char_length(timezone) <= 64 and timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}$'),
  constraint profiles_default_calendar_view_check check (default_calendar_view in ('month', 'week', 'day')),
  -- 0 = Sunday, 1 = Monday
  constraint profiles_week_starts_on_check check (week_starts_on in (0, 1))
);

comment on table public.profiles is 'Per-user preferences. Created automatically when an auth user is created.';

-- ---------------------------------------------------------------------------
-- activity_categories
-- ---------------------------------------------------------------------------
create table public.activity_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_categories_name_check check (char_length(name) between 1 and 40 and name = btrim(name)),
  constraint activity_categories_color_check check (color ~ '^#[0-9a-f]{6}$'),
  -- Target of the composite ownership FK from activities.
  constraint activity_categories_id_user_id_key unique (id, user_id)
);

create unique index activity_categories_user_name_key
  on public.activity_categories (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  title text not null,
  notes text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_title_check check (char_length(title) between 1 and 120 and title = btrim(title)),
  constraint activities_notes_check check (notes is null or char_length(notes) between 1 and 2000),
  constraint activities_status_check check (status in ('scheduled', 'completed')),
  constraint activities_time_order_check check (end_at > start_at),
  constraint activities_max_duration_check check (end_at - start_at <= interval '24 hours'),
  constraint activities_time_range_check
    check (start_at >= timestamptz '1970-01-01 00:00:00+00' and end_at < timestamptz '2200-01-01 00:00:00+00'),
  constraint activities_category_fk foreign key (category_id, user_id)
    references public.activity_categories (id, user_id) on delete restrict
);

-- Range scans: start_at < :range_end and start_at >= :range_start - 24h (max duration).
create index activities_user_start_idx on public.activities (user_id, start_at);
-- Category filters and the ownership FK's ON DELETE RESTRICT check.
create index activities_user_category_idx on public.activities (user_id, category_id);

-- ---------------------------------------------------------------------------
-- finance_categories
-- ---------------------------------------------------------------------------
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  name text not null,
  color text not null,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_kind_check check (kind in ('income', 'expense')),
  constraint finance_categories_name_check check (char_length(name) between 1 and 40 and name = btrim(name)),
  constraint finance_categories_color_check check (color ~ '^#[0-9a-f]{6}$'),
  -- Target of composite FKs: a transaction's category must belong to the same user AND
  -- match the transaction type; budgets may only reference expense categories.
  constraint finance_categories_id_kind_user_id_key unique (id, kind, user_id)
);

create unique index finance_categories_user_kind_name_key
  on public.finance_categories (user_id, kind, lower(name));

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  amount_minor bigint not null,
  currency text not null,
  occurred_on date not null,
  category_id uuid not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_type_check check (type in ('income', 'expense')),
  -- Positive integer minor units; the type carries the direction. Upper bound keeps sums
  -- comfortably inside JavaScript's safe-integer range.
  constraint transactions_amount_minor_check check (amount_minor between 1 and 9999999999),
  constraint transactions_currency_check check (currency in ('EUR', 'BGN')),
  constraint transactions_occurred_on_check check (occurred_on between date '1970-01-01' and date '2199-12-31'),
  constraint transactions_description_check
    check (description is null or (char_length(description) between 1 and 200)),
  constraint transactions_category_fk foreign key (category_id, type, user_id)
    references public.finance_categories (id, kind, user_id) on delete restrict
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on);
create index transactions_user_category_idx on public.transactions (user_id, category_id);

-- ---------------------------------------------------------------------------
-- budgets: monthly spending limit per expense category and currency
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  -- Constant column that lets the composite FK require an *expense* category.
  category_kind text not null default 'expense',
  month date not null,
  currency text not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_category_kind_check check (category_kind = 'expense'),
  constraint budgets_month_check
    check (extract(day from month) = 1 and month between date '1970-01-01' and date '2199-12-01'),
  constraint budgets_currency_check check (currency in ('EUR', 'BGN')),
  constraint budgets_amount_minor_check check (amount_minor between 1 and 9999999999),
  constraint budgets_category_fk foreign key (category_id, category_kind, user_id)
    references public.finance_categories (id, kind, user_id) on delete cascade,
  constraint budgets_user_category_month_currency_key unique (user_id, category_id, month, currency)
);

create index budgets_user_month_idx on public.budgets (user_id, month);

-- ---------------------------------------------------------------------------
-- Timestamp triggers
-- ---------------------------------------------------------------------------
create trigger set_timestamps before insert or update on public.profiles
  for each row execute function private.set_timestamps();
create trigger set_timestamps before insert or update on public.activity_categories
  for each row execute function private.set_timestamps();
create trigger set_timestamps before insert or update on public.activities
  for each row execute function private.set_timestamps();
create trigger set_timestamps before insert or update on public.finance_categories
  for each row execute function private.set_timestamps();
create trigger set_timestamps before insert or update on public.transactions
  for each row execute function private.set_timestamps();
create trigger set_timestamps before insert or update on public.budgets
  for each row execute function private.set_timestamps();
