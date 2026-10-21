# Supabase integration checkpoint — October 21, 2026

## Resume from this branch

Repository: https://github.com/sigfriedjk/timesheet

Branch: `wip/supabase-integration-20261021`

Production: https://sigfriedjk.github.io/timesheet/

Base production commit: `17d7bb8303df2d04528b512f6d6d14bf3c2bbd56`.

This is an unfinished checkpoint, not a deployable release. The user paused implementation to republish the cloud environment with `SUPABASE_SECRET_KEY`, then requested that the draft be committed with a handoff prompt. Nothing in this checkpoint has been deployed, and no Supabase database or authentication configuration changes have been made by the assistant. Do not infer that the SQL has been run: the user explicitly paused that request.

## User's goal

Use Supabase's client-side JavaScript library for personal timesheet data by default. Keep the sample workspace entirely client-side, available without signing in, and isolated from real data. Preserve all existing calculator, calendar, monthly leave, and POP summary behavior. Production publication has been authorized throughout the project, but finish and verify the integration before publishing it.

Project base URL: `https://yiqquogdutgujsacoezh.supabase.co`.

The user provided the public publishable key, which is already in `src/config/supabasePublic.ts`. Their original URL ended with `/rest/v1/`; use the base project URL with the JavaScript client. Public browser config can be overridden with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`) or the draft Settings form.

## Environment secret and access

The user added an environment variable named `SUPABASE_SECRET_KEY`. At checkpoint time, `Boolean(process.env.SUPABASE_SECRET_KEY)` was false and the environment status reported no secret bindings. They intend to republish the environment to make it available.

After restarting, check environment status and the variable's presence without printing its value. Keep this key server-side in the execution environment. Never put it in any `VITE_*` variable, source file, browser bundle, committed configuration, log, or screenshot. The browser must use the public publishable key plus a user's Supabase Auth session and RLS.

A Supabase project secret key usually grants privileged data API access; it is not automatically a Supabase Management API access token or a PostgreSQL connection credential. Determine which operations the available credential actually authorizes before attempting schema setup. Do not assume the secret can execute arbitrary SQL or change Auth settings. If admin access remains unavailable, explain the exact missing capability and provide the already-prepared SQL for the user to run.

Read the managed environment runtime instructions and current network policy before network work. The prior policy allowed package registries and GitHub, but did not list the Supabase project host; check the republished environment's current policy. Do not bypass destination restrictions. `npm install --cache /workspace/.npm-cache` works in this workspace; the default home cache path was unavailable. Public GitHub fetch worked with ordinary git at checkpoint time; connected GitHub tools also support commits and branches.

## Draft implementation already saved

- `package.json` and `package-lock.json`: installed `@supabase/supabase-js` 2.118.0.
- `src/config/supabasePublic.ts`, `src/services/supabaseConfig.ts`, `.env.example`, `src/vite-env.d.ts`: public configuration, browser overrides, and rejection of secret/service-role keys in the browser form.
- `supabase/migrations/202610210001_timesheet.sql`: transactional, repeatable setup for `timesheet_logs`, `timesheet_reports`, per-user RLS, updated-at triggers, and an atomic `import_browser_timesheet` RPC. It is prepared but not applied or tested against a real project.
- `src/services/supabaseRepository.ts`: paged reads (500 rows per page), user-scoped log upsert/delete, report JSON persistence, and an import RPC preserving existing cloud dates/settings.
- `src/hooks/useSupabaseConnection.ts`: draft session recovery, persisted Supabase Auth sessions, and client creation only when personal data is selected. It needs lifecycle/session-race review and testing.
- `src/hooks/useWorkspace.ts`: draft async repository/local-sample routing, loading/error states, guarded updates after source/user changes, save serialization, and an explicit browser-data import action. Review carefully; not wired into App yet.
- `src/components/SupabaseSettings.tsx`: draft email magic-link sign-in, sign-out, public connection configuration, local-browser import, SQL copy/download, and setup instructions. Not wired into App yet.
- `src/components/SettingsView.tsx`: now expects `connection`, `workspace`, and an async leave-settings callback; it renders the draft Supabase panel. App still supplies the old props, so the checkpoint does not build.
- `.gitignore`: excludes `work/`, which contains disposable browser profiles, scratch scripts, screenshots, and local verification artifacts. Do not commit those files.

The public project key is intentionally browser-safe; no environment secret is present in this checkpoint.

## Verification at checkpoint

`npm test`: all 50 existing tests pass. These cover existing local storage and calculator/calendar/monthly/POP calculations; they do not verify the new Supabase integration.

`npm run build`: fails with these reported TypeScript errors:

1. `src/App.tsx:145`: a synchronous leave-settings callback returns void where `Promise<void>` is now required.
2. `src/services/supabaseRepository.ts:29`: `data` may be null after a query.
3. `src/services/supabaseRepository.ts:43`: `data` may be null after a delete.

More wiring issues may appear after fixing those errors. Do not treat passing legacy tests as evidence the Supabase draft is complete.

## Remaining implementation

1. Check the new secret and actual administrative capabilities. Apply and verify the SQL schema when authorized access permits. Configure Supabase Auth Site URL to `https://sigfriedjk.github.io/timesheet/` and allow redirect URL `https://sigfriedjk.github.io/timesheet/**` if magic-link auth is retained. Do not send sign-in emails on behalf of the user; the UI can let them request a link themselves.
2. Review SQL/RLS with two users and an unauthenticated client; verify cross-user reads/writes and imports are denied. Privileged secret-key requests bypass RLS and cannot prove user isolation.
3. Wire `useSupabaseConnection` and `useWorkspace` into `src/App.tsx`. It still uses synchronous personal localStorage today. Personal data should default to Supabase. Sample data should initialize only its local store, never touch Supabase tables, and remain usable offline. Use explicit `?sample=2026`/Settings selection for sample mode; normal fresh visits should use Supabase.
4. Gate personal views on auth and completed data loading, expose retry on load failures, clear previous-user data when accounts/sources/projects change, and avoid silently falling back to browser storage for failed cloud writes.
5. Convert calculator, calendar day editor, monthly editor, and leave-settings form callbacks to await persistence. Preserve drafts and dialogs on failure, report errors, prevent duplicate saves, and navigate to the calendar or show success only after a successful save. Review `useWorkspace` snapshot and concurrency handling.
6. Preserve existing personal browser records and report settings. Import should be explicit for the signed-in user, atomic, non-destructive, and prefer existing cloud rows/settings. Never import the sample workspace. POP definitions remain hardcoded and shared.
7. Fix query nullability, inspect Auth lifecycle/StrictMode behavior, and test session recovery, sign-out, account changes, errors, long history pagination, report persistence, import conflicts, and sample isolation. Add meaningful Supabase tests; existing test suite alone is insufficient.
8. Add CSS for the draft Supabase access/settings/forms, SQL display, and loading/error states; check desktop and mobile layouts.
9. Update README/design documentation and production smoke checks. `scripts/verify-production.mjs` currently expects an unauthenticated normal visit to render the calculator; that must change if personal views require sign-in. Preserve sample calculator/calendar/monthly/POP checks and verify sample mode makes no Supabase requests.
10. Build, test, verify live backend behavior and browser flows, then merge/publish the completed integration to production and verify the production URL and assets. The Pages workflow deploys pushes to `main`; this WIP branch does not deploy automatically.

## Existing app context

React 18, TypeScript, Vite; static GitHub Pages hosting. Daily inputs use 24-hour times, separate actual time-out from reference helper cards, and 6-minute break adjustments. Save transitions to Calendar. Sample logs cover January 1–October 20, 2026: 149 entries, 1,210.7 hours, February/August empty. Sample controls and downloads belong only in Settings.

Monthly report state includes opening balances, leave settings/entries, projected work, and a versioned automatic-PTO migration. Historical gaps default to PTO, including empty months, but explicit monthly PTO entries (including zero) override inference. Preserve subsequent opt-outs and personal/sample isolation. Fixed POP A–X definitions are in `src/config/periodsOfPerformance.ts`; 2026 sample POP totals are 1,915 funded, 1,210.7 worked, and 704.3 remaining hours. The 24 POPs span April 25, 2024–June 30, 2027.
