# Open investigation: `/stats` once ended up on `/calendar`

**Status:** open. It has not been reproduced since a hydration fix, but the root cause was
never confirmed. Kept here so it can be investigated separately from other work.

## What was observed (once, 14 October 2026)

- **Environment:** `npm run dev:local` (Next.js 16.4 dev server with Turbopack, plus the local
  Supabase emulator with an in-memory database), viewed in the embedded browser pane of the
  coding tool (not a normal browser window).
- **Steps:** while signed in, the browser was navigated to `http://localhost:3000/stats`.
- **Result:** the page ended up on `/calendar`, showing no data, with the red Next.js dev-tools
  issue badge visible.
- **Console:** only `WebSocket connection to 'ws://127.0.0.1:54321/realtime/v1/websocket'
  failed` errors. These are expected because the emulator has no Realtime (the app falls back to
  "Auto-refresh"), and they are not related.
- **Server:** `/stats` answered normally (HTTP 200 in about 450 ms), and the emulator responded
  immediately. No redirect for `/stats` was logged.

## What was found and changed

- A real **hydration mismatch** existed at the time. The sync indicator rendered "Last synced
  HH:MM" during server rendering, and the browser computed a different minute. It was fixed
  (`features/app/sync-indicator.tsx` now shows the time only after hydration). This matches the
  red dev-tools badge.
- After the fix, `/stats` stayed on `/stats` for a 10-second URL timeline, with no hydration
  errors in the console.

## What is *not* established

It was never confirmed that the hydration error *caused* the navigation. Other explanations
were not ruled out:

1. **The pane reloaded its start URL.** The embedded browser tab had been opened at
   `http://localhost:3000/`, and `next.config.ts` redirects `/` to `/calendar`. A dev-server
   restart or a full reload of the tab's original URL would land on `/calendar`. The server
   was restarted around that time.
2. **Fast Refresh fell back to a full reload** after a file edit. Normally that reloads the
   current URL, but combined with (1) it could also explain it.
3. **A client-side recovery re-render after the hydration error.** React throws away the
   server HTML and renders again on the client. No code path that navigates to `/calendar`
   during such a render is known. The login form's default `next` target is `/calendar`, but
   that only applies on the sign-in page.

## Guard rails in place

`e2e/navigation.spec.ts`. Both tests fail on any uncaught page error and on any React
hydration error in the console:

- *the sidebar reaches every screen and stays there*: clicks each nav link and checks the URL,
  the `h1` and `aria-current`.
- *every screen renders on a direct load without hydration errors*: loads every route
  directly, waits for `networkidle`, then checks the URL is unchanged.

These pass against a production build and the local emulator (`E2E_PROD=1 npx playwright test`).
They have not been run against a real Supabase project or in the dev server.

## How to investigate further

1. Run `npm run dev:local` in a normal browser (Edge/Chrome), sign in and open DevTools with
   *Preserve log* enabled in both the Console and Network panels.
2. Navigate to `/stats` via the sidebar and via the address bar. Also try it right after editing
   a file, so Fast Refresh runs.
3. Paste this into the console *before* navigating, to log every URL change:
   ```js
   for (const method of ["pushState", "replaceState"]) {
     const original = history[method].bind(history);
     history[method] = (...args) => (console.trace(method, args[2]), original(...args));
   }
   addEventListener("popstate", () => console.trace("popstate", location.href));
   ```
4. In the Network panel, look for a document request to `/` or `/calendar`. That would mean a
   full reload or a redirect, not a client-side navigation.
5. If it reproduces, the stack trace from step 3 shows which code changed the URL.
