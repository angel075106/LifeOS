# LifeOS — personal command center

LifeOS is a private web app (installable as a PWA on Windows and iPhone) that combines an
interactive **calendar**, **activity/time tracking**, **income & expense tracking**, **monthly
budgets** and **statistics**. The calendar is the home screen: every day shows what you did, how
long it took, what came in and what went out.

Built on the official Next.js + Supabase starter (`create-next-app -e with-supabase`), keeping its
cookie-based Supabase Auth integration.

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick start on Windows](#quick-start-on-windows)
4. [Supabase setup (real project)](#supabase-setup-real-project)
5. [Database schema & migrations](#database-schema--migrations)
6. [Security model](#security-model)
7. [Sync across devices](#sync-across-devices)
8. [Installing the app (Windows & iPhone)](#installing-the-app-windows--iphone)
9. [Testing](#testing)
10. [Deployment (Vercel)](#deployment-vercel)
11. [Known limitations](#known-limitations)
12. [Commands reference](#commands-reference)

---

## Features

**Calendar (home screen)**
- Month, week and day views; previous/next and **Today**; the view and date live in the URL
  (`/calendar?view=week&date=2026-10-14`), so reloads and bookmarks keep your place.
- Today is marked with a filled circle; each day lists its first activities (category dot +
  title, hollow dot when scheduled), tracked time, income (`+`) and expenses (`−`). Narrow phone
  cells switch to category dots, hours and up/down arrows; every cell has a full spoken description.
- Day panel: totals (time, income, expenses, net cash flow per currency), quick-add buttons, a
  compact chronological agenda and the day's transactions. Activities crossing midnight appear on
  both days with "from previous day"/"continues" markers.
- Upcoming: what is happening now ("Now, until 12:30") and the next activities of the coming
  7 days, each one click away from editing or from its day in the calendar.
- Week/day time grid: overlapping activities sit side by side, scheduled entries are dashed and
  labeled, a "now" line marks the current time, and clicking an empty slot starts a new entry.
- Keyboard: arrow keys, Home/End and PageUp/PageDown move through the month grid.

**Activities**
- Create, edit, delete, search (title, notes, category) and filter (category, status, period).
- Title, category, start/end (date + time, up to 24 h, may cross midnight), live duration,
  notes, scheduled/completed status, server-maintained created/updated timestamps.
- Overlap warning before saving, listing the overlapping entries; "Save anyway" when intended.
- Default categories (Training, Running, Work, Study, Coding, Personal, Sleep) plus your own with
  custom colors; archive (hide from pickers) or delete with a replacement category.

**Finance**
- Income and expenses with integer minor-unit amounts, EUR (default) or BGN, date, category and
  optional description/merchant. Comma or dot decimals are accepted.
- Totals are **always kept per currency** — EUR and BGN are never added together. "Net cash
  flow" is income minus expenses in the period, explicitly not a bank balance.
- Overview per month: KPI tiles, daily income-vs-expense chart, spending/income by category,
  budgets, recent transactions. Transaction list with search, filters and exact filtered totals.
- Monthly budgets per expense category and currency, utilization meters with
  "On track / Near limit (≥ 80 %) / Over budget" (icon + text, not color alone), and
  "copy from previous month".

**Statistics** — time by category, tracked time per day/week/month, income vs expenses, net
cash flow, spending by category and budget utilization for any period, computed from your saved
records. Every chart has a table view.

**Settings** — appearance (Light, Dark or System theme, saved on this device and applied before
the first paint, also switchable from the sidebar/header theme menu), display name, default currency, time zone (with "use this device's time zone"),
default calendar view, week start, activity & finance category management, CSV export
(transactions and activities, formula-injection safe), password change, sign out (this device
or everywhere), install instructions.

---

## Architecture

```
app/                      Next.js App Router
  (app)/                  authenticated area: layout = auth gate + providers + shell
    calendar/ activities/ finance/{,transactions,budgets}/ stats/ settings/
  auth/                   starter auth pages (restyled) + /auth/confirm, /auth/callback
  api/export/*            CSV route handlers (session-checked, no-store)
  manifest.ts             web app manifest
components/ui             design system: buttons, inputs, dialogs, cards, menus, toasts…
components/theme          light/dark/system theme: pre-paint script, controller, selector, menu
components/charts         Recharts wrappers + accessible bar lists, meters, table views
features/<area>/          screens, Server Actions (*/actions.ts), Zod schemas, pure logic
lib/                      money, dates/time zones, CSV, errors, env, Supabase clients, data access
supabase/migrations       versioned SQL (tables, RLS, grants, triggers, RPCs, realtime)
supabase/tests            manual RLS verification script for your real project
scripts/local-supabase    local Supabase emulator for development & browser tests
tests/db, **/*.test.ts    Vitest unit + database tests;  e2e/  Playwright browser tests
```

- **Reads**: TanStack Query in the browser, using the Supabase browser client with the user's
  session. RLS limits every query to the user's rows. Queries refetch on window focus, on
  reconnect, after mutations and on Realtime notifications.
- **Writes**: Next.js **Server Actions**. Each re-verifies the session (`getClaims()`), validates
  input with Zod, writes through the user's session (so RLS still applies), and returns the
  saved row. The UI only reports success after the database confirmed the write.
  - Creates use a **client-generated UUID**, so a double tap or a retry after a timeout cannot
    create duplicates.
  - Edits send the `updated_at` the client last saw; if another device changed the record in the
    meantime, the save is refused with a clear message instead of silently overwriting.
- **Routing/auth**: `proxy.ts` (Next 16's middleware) refreshes the session cookie and sends
  signed-out visitors to `/auth/login?next=…`. The `(app)` layout verifies the session again on
  the server; API routes return `401`.
- **Cache Components** (`cacheComponents: true`, from the starter) stay enabled: static shells are
  prerendered without user data; everything user-specific renders at request time behind
  Suspense.
- **Time zones**: activity start/end are stored as `timestamptz` instants; each user has an IANA
  time zone in their profile. The app converts local date + time to instants in that zone
  (DST-correct: a non-existent spring-forward time moves forward; an ambiguous fall-back time
  takes the earlier instant) and buckets activities into local days. Daily durations use real
  elapsed time, clipped at local midnight (a 25-hour DST day can hold 25 h). Transactions store a
  plain calendar `date`, so they never shift between days.
- **Money**: `bigint` minor units in the database, safe integers in TypeScript, string-based
  parsing and exact `Intl` formatting — no floating-point value is ever the source of truth.
- **Design system**: semantic color tokens in `app/globals.css` (`canvas`, `surface`, `muted`,
  `border`, `fg`/`fg-muted`/`fg-subtle`, `accent`, `income`, `expense`, `warning`, `danger`,
  `chart-*`) with light values on `:root` and dark values on `[data-theme="dark"]`. Components
  use only these tokens (e.g. `bg-surface`, `text-fg-muted`, `dark:` for rare exceptions). Text
  pairs meet WCAG AA (4.5:1), form borders and the focus ring 3:1; chart colors pass the
  palette checks (lightness, chroma, color-vision-deficiency separation, contrast) in both themes.
- **Theme**: the choice (`light`/`dark`/`system`) is stored per device in `localStorage`
  (`lifeos-theme`). A small inline script in `<head>` (`lib/theme.ts`) sets
  `<html data-theme>` before the body is parsed, so there is no flash of the wrong theme;
  `ThemeSync` keeps it in sync with OS changes and other tabs.

---

## Quick start on Windows

Prerequisites: Node.js 20.9+ (24 LTS recommended) and npm. All commands are for PowerShell in
`D:\Projects\lifeos`.

```powershell
cd D:\Projects\lifeos
npm install
```

### Option A — try it locally without a Supabase project

Runs the bundled **local Supabase emulator** (real LifeOS migrations on an embedded Postgres)
plus the dev server:

```powershell
npm run dev:local
```

Open http://localhost:3000, choose **Create an account** (any email; no email is sent), and you
are in. Data persists in `.local-supabase/` (git-ignored). The emulator is for development and
testing only — see [its limitations](#known-limitations).

### Option B — with your real Supabase project

1. Complete [Supabase setup](#supabase-setup-real-project) below.
2. Create `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Start the dev server:
   ```powershell
   npm run dev
   ```
4. Open http://localhost:3000 and sign up.

### Open the dev server on your phone

1. Only one dev server can run in this folder. Stop `npm run dev:local` first. A second server
   prints "Another next dev server is already running" and exits, and port 3000 keeps serving
   the emulator, which your phone cannot reach.
2. Run `npm run dev` (it already listens on your network) and open the **Network** address it
   prints (e.g. `http://192.168.1.18:3000`) in Safari on the same Wi-Fi.
3. The dev server accepts this computer's own network addresses automatically. Other host
   names (e.g. `my-pc.local`) need `LIFEOS_DEV_ORIGINS` in `.env.local`; without it the page
   loads but its buttons do nothing.
4. For sign-up and password-reset emails sent from the phone, add
   `http://<that address>:3000/**` to the Supabase Redirect URLs (see below).

### Production build locally

```powershell
npm run build
npm run start
```

---

## Supabase setup (real project)

You need to do these steps in the Supabase dashboard — LifeOS cannot do them for you.

1. **Create a project** at https://supabase.com/dashboard (pick a region near you, e.g.
   Frankfurt). Save the database password somewhere safe (it is not needed in `.env.local`).
2. **Get the API values**: *Project Settings → API* (or the **Connect** button):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable** key (or the legacy **anon** key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Never use the **secret**/**service_role** key in LifeOS. The app refuses to start if one is
     placed in that variable.
3. **Apply the migrations** (in filename order). Either:
   - **Supabase CLI** (no Docker needed for this):
     ```powershell
     npx supabase login
     npx supabase link --project-ref YOUR_PROJECT_REF
     npx supabase db push
     ```
   - **or the SQL Editor**: open each file in `supabase/migrations/` in order, paste, **Run**:
     1. `20261014120000_core_schema.sql`
     2. `20261014120100_rls_and_grants.sql`
     3. `20261014120200_new_user_bootstrap.sql`
     4. `20261014120300_realtime_broadcast.sql`
     5. `20261014120400_category_and_budget_functions.sql`
4. **Verify RLS**: paste `supabase/tests/rls_verification.sql` into the SQL Editor and run it. It
   creates two throwaway users inside a transaction, checks isolation, and rolls back.
   **"Success. No rows returned"** means every check passed; any problem stops with `FAIL: …`.
5. **Auth → URL Configuration**:
   - Site URL: your production URL (e.g. `https://lifeos-yourname.vercel.app`).
   - Redirect URLs: add `http://localhost:3000/**` and `https://YOUR-PRODUCTION-DOMAIN/**`.
6. **Auth → Providers → Email**: decide whether new sign-ups must confirm their email. For a
   personal app you can keep confirmation on. In *Auth → Settings*, set the minimum password
   length to **8** (the app also enforces 8).
7. *(Recommended)* **Email template** for cross-device confirmation: in *Auth → Email Templates →
   Confirm signup*, change the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/calendar`.
   With the default template, links still work via `/auth/callback`, but only in the browser
   where you signed up.
8. **Realtime** (live sync): the migration creates per-user private broadcast topics and the
   authorization policy — no dashboard change is needed. If live sync shows **Auto-refresh**
   instead of **Live**, check *Realtime → Settings* and the project's logs.

> **Supabase 2026 change**: new projects no longer expose new tables to the Data API
> automatically. The LifeOS migrations include the required explicit `GRANT`s (minimal: no
> access for `anon`; column-level `UPDATE` for signed-in users).

---

## Database schema & migrations

Migrations live in `supabase/migrations/` (Supabase CLI format).

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | one row per user: currency, time zone, default view, week start | created by a trigger on `auth.users` |
| `activity_categories` | per-user categories with color | unique name per user (case-insensitive) |
| `activities` | title, category, `start_at`/`end_at` (`timestamptz`), status, notes | `end > start`, ≤ 24 h |
| `finance_categories` | per-user income/expense categories | `kind` fixed after creation |
| `transactions` | type, `amount_minor bigint` (> 0), currency (EUR/BGN), `occurred_on date`, category, description | category kind must equal type |
| `budgets` | expense category + month (first day) + currency + amount | one per category/month/currency |

- UUID primary keys, `created_at`/`updated_at` maintained by triggers (not client-writable).
- **Composite ownership foreign keys**: e.g. `activities (category_id, user_id) → activity_categories (id, user_id)`.
  FK checks bypass RLS, so this is what stops a user from attaching rows to someone else's
  category even if they knew its id. Transactions additionally require the category's `kind`
  to match the transaction `type`; budgets only accept expense categories.
- New users: `private.handle_new_user()` creates the profile (time zone from sign-up) and default
  categories. Users that existed before the migration are backfilled, and the app calls
  `bootstrap_current_user()` if a profile is ever missing.
- RPCs (`security invoker`, so RLS applies): `delete_activity_category`,
  `delete_finance_category` (with optional replacement, atomic), `upsert_budget`, `copy_budgets`.
- Derived numbers (durations, totals, net cash flow, budget usage) are computed from records;
  no duplicated totals are stored.

---

## Security model

- **Row Level Security on every table**, with explicit SELECT/INSERT/UPDATE/DELETE policies
  `(select auth.uid()) = user_id` (profiles: select/update only). `anon` has no grants at all.
- **Column-level UPDATE grants**: ids, owners and timestamps cannot be changed through the API.
- Server Actions and route handlers verify the session on every call and validate all input with
  Zod; the database enforces the same rules again with CHECK constraints and foreign keys.
- Only the public URL and publishable key reach the browser; the app has no use for a
  service-role key and rejects one if misconfigured.
- `.env.local` (and all `.env*` except `.env.example`) are git-ignored.
- Errors shown to users are mapped to plain messages; database details are never displayed.
  Server logs record the operation and error code only — never amounts, titles or notes (the dev
  server's Server Function argument logging is disabled for the same reason).
- Auth redirects (`?next=`) are restricted to same-origin paths (no open redirect); the auth error
  page only renders known reason codes.
- Security headers: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limited to
  this app and your Supabase project), `X-Frame-Options: DENY`, `nosniff`, strict referrer
  policy, Permissions-Policy, HSTS in production.
- CSV exports neutralize cells starting with `=`, `+`, `-`, `@`, tab or CR (OWASP formula
  injection guidance) and are sent with `Cache-Control: private, no-store`.

Isolation is verified three ways: `tests/db/schema.test.ts` (migrations + RLS on Postgres),
`supabase/tests/rls_verification.sql` (your real project), and `e2e/isolation.spec.ts` (two real
sessions through the Data API and the UI).

---

## Sync across devices

- **Supabase is the source of truth.** Nothing is stored offline.
- **Live updates**: each write fires a tiny Realtime **Broadcast** on the user's private topic
  `user:<id>` (payload: table name only, never row data). Other devices re-fetch the affected
  data through the normal RLS-protected API. Bursts are coalesced; duplicate events are harmless
  because they only trigger a refetch.
- **Fallbacks**: data also refreshes when the app returns to the foreground or reconnects, and
  every minute while live sync is unavailable. After a dropped Realtime connection is restored,
  everything is refreshed once.
- The sync pill shows **Live**, **Syncing/Saving**, **Auto-refresh** (Realtime unavailable) or
  **Offline**.
- **Offline**: saving fails immediately with a clear message — there is no offline write queue in
  V1. Server Actions time out after 20 s with a "may not have been saved" message and the data is
  refreshed so you can check.

---

## Installing the app (Windows & iPhone)

LifeOS must be served over **HTTPS** to be installable (e.g. on Vercel); `http://localhost` also
works for testing on the same PC.

**Windows (Edge or Chrome)** — open LifeOS, sign in, then click the **Install app** icon in the
address bar (or *menu → Apps → Install this site as an app*). Settings → *Install LifeOS* also
offers an **Install** button when the browser supports it.

**iPhone (Safari)** — open LifeOS, tap **Share → Add to Home Screen → Add**, then open it from the
Home Screen and **sign in again** (installed web apps keep a separate session from Safari).

**Honest limitations**: it is the web app in its own window, not a store app. It requires a
connection (an offline notice appears without one), has no push notifications or background
sync, and its service worker caches only the offline page — never your data.

---

## Testing

```powershell
npm run lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
npm run typecheck   # tsc --noEmit (strict)
npm test            # Vitest: unit tests + database tests (PGlite)
npm run test:e2e    # Playwright browser tests (see below)
npm run verify      # lint + typecheck + unit/db tests + production build
```

- **Unit tests** cover money parsing/formatting, cash-flow and budget calculations, category
  totals, date/time-zone math (DST gaps/overlaps, 23/25-hour days, host-zone independence),
  calendar day bucketing and overlap layout, overlap detection, form/server validation, CSV
  escaping, redirect validation, error mapping and env-key safety.
- **Database tests** (`tests/db`) apply the real migrations to an in-process Postgres (PGlite)
  with a small Supabase shim and verify RLS isolation, grants, constraints, triggers, RPCs and the
  Realtime authorization policy — and that `rls_verification.sql` detects broken policies.
- **Browser tests** (`e2e/`): sign-in, create & edit an activity, income, create & delete an
  expense, correct calendar dates, persistence after reload, overlap warning, validation,
  unauthorized access (two users, UI + Data API + CSV), PWA/security headers, phone layouts and
  the theme (saved choice applied before paint, System following the OS, keyboard selection).
  - Default: runs against the **local emulator** with a fresh in-memory database, using the
    installed Microsoft Edge (no browser download).
  - Against your **real Supabase project** (recommended before relying on it): create two
    dedicated test users, start the app, then:
    ```powershell
    $env:E2E_BASE_URL = "http://localhost:3000"
    $env:E2E_USER_EMAIL = "test-a@example.com";  $env:E2E_USER_PASSWORD = "..."
    $env:E2E_USER2_EMAIL = "test-b@example.com"; $env:E2E_USER2_PASSWORD = "..."
    npm run test:e2e
    ```
    (`NEXT_PUBLIC_SUPABASE_*` are read from `.env.local`.) Tests tag and delete their own records.

---

## Deployment (Vercel)

1. Push the repository to GitHub (keep `.env.local` out of it — it is git-ignored).
2. In Vercel: **Add New → Project**, import the repository (framework: Next.js; defaults are fine).
3. Add environment variables (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They are needed **at build time** (inlined into the
   browser bundle and the CSP `connect-src`), so redeploy after changing them.
4. Deploy, then add the production URL to Supabase *Auth → URL Configuration* (Site URL and
   Redirect URLs).
5. Open the production URL on your PC and iPhone and install it as described above.

Any Node.js host that runs `npm run build && npm run start` works the same way (Cache Components
requires the Node.js runtime, not Edge).

---

## Known limitations

- **No offline mode**: viewing and saving require a connection (by design for V1).
- **No currency conversion**: EUR and BGN totals are shown separately. (BGN was replaced by the
  euro on 1 January 2026 at the fixed rate 1.95583; a conversion setting could be added later.)
- **Activities are limited to 24 hours** each; multi-day events need one entry per day.
- **Time zone changes** re-display activities in the new zone (instants are absolute); transaction
  dates never move.
- **Realtime delete notifications** carry only a table name; no record data is broadcast.
- **Local emulator** (`npm run dev:local`, default E2E mode): runs the real migrations, RLS and
  constraints on PGlite, but implements only the parts of Supabase Auth/PostgREST that LifeOS uses,
  has **no Realtime** (the app shows Auto-refresh), sends no email and auto-confirms sign-ups. It is
  a development/test tool — always verify against a real Supabase project before production use.
- **CSP** allows inline scripts (`'unsafe-inline'`) because nonce-based CSP would disable static
  prerendering; it still blocks framing, plugins, foreign form targets and unknown network origins.
- **Open investigation**: once, in the dev server inside an embedded browser pane, opening
  `/stats` ended up on `/calendar`. It has not been reproduced since a hydration fix, and the cause
  is unconfirmed. Details, hypotheses and reproduction steps:
  [docs/investigations/stats-navigation.md](docs/investigations/stats-navigation.md).
- **Account deletion** is not built into the UI; delete the user in the Supabase dashboard
  (*Authentication → Users*), which removes all their LifeOS data via cascades.
- **Type definitions** in `lib/supabase/database.types.ts` are hand-written in the generated
  format; regenerate with `npx supabase gen types typescript --project-id <ref>` after schema
  changes.

---

## Commands reference

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (uses `.env.local`) |
| `npm run dev:local` | Local Supabase emulator + dev server (no Supabase project needed) |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + database tests |
| `npm run test:e2e` | Playwright browser tests (local emulator by default) |
| `npm run verify` | Lint, typecheck, tests and production build |
| `npm run supabase:local` | Only the local emulator (port 54321) |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons from `scripts/icons/*.svg` |
