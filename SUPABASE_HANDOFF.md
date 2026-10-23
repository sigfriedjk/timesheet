# Current single-owner admission policy

The project permits only its existing owner. New signups and anonymous sign-ins are disabled server-side; email sign-in stays enabled. `npm run lock:supabase` applies and independently reads back the policy. `npm run verify:admission` checks live signup rejection and existing-owner read-only sign-in/session refresh without creating accounts or sending email. The older disposable-user verifier now refuses signup-disabled projects. See [SINGLE_OWNER_ACCESS.md](SINGLE_OWNER_ACCESS.md) for current setup/recovery instructions. Historical references below to enabled signups or production disposable accounts are superseded.

# Private workspace configuration status

The additive private-configuration schema and confirmed account backfill have been applied and checked without changing existing POPs, logs, or other saved settings. The rate was inserted only where missing. Repeating the backfill made no changes. PR #17 was merged and deployed with user authorization; this section describes that completed migration.

See [PRIVATE_CONFIGURATION.md](PRIVATE_CONFIGURATION.md) for current rate units, backup compatibility, validation, and historical exposure. Older release notes below are historical and do not override the current storage and restore rules.

# Supabase integration handoff — October 21, 2026

## Resume here

### Complete workspace backup update

A prior release added per-account editable POP definitions (`timesheet_pop_settings`), a version 2 backup covering every saved input, and confirmed JSON replacement through `replace_timesheet_workspace`. Birthday credit is fixed to January; opening balances and the existing work-rate/PTO-inference/monthly-forecast inputs are retained. Monthly balances are calculated. Daily calculator helper inputs remain temporary. Older JSON files are accepted with an explicit omitted-section/default-reset warning. Browser migration remains non-destructive.

The second migration (`202610220001_complete_workspace.sql`) has been applied live. 83 unit/PostgreSQL tests, 12 browser tests, build/local production smoke, and real Supabase/Chromium checks pass, including POP isolation, complete replacement of all leave categories/settings/POPs, rollback after invalid data, session refresh and cleanup of disposable accounts. Setup now applies all migration files in order. The remaining sections describe older releases and are historical.

- Repository: https://github.com/sigfriedjk/timesheet
- Branch: `wip/supabase-integration-20261021` — check it out and read this file first.
- Production: https://sigfriedjk.github.io/timesheet/
- Production/base commit: `17d7bb8303df2d04528b512f6d6d14bf3c2bbd56`.
- Initial draft checkpoint: `3c79366f5b9f0b1a2baef1f472f01a2070274208`.

**The Supabase migration and production Auth URL configuration are verified, and live backend/browser verification passes. The integration is ready for release through PR #1.** Deployment is authorized; verify the Pages Actions run and actual production assets/browser smoke report after merging.

## Release readiness — October 21, 2026 (America/New_York)

- The user saved the production Auth URLs in the dashboard. Management API readback confirms Site URL `https://sigfriedjk.github.io/timesheet/`, redirect allowlist `https://sigfriedjk.github.io/timesheet/**`, email enabled, and signups enabled. The previous Auth permission blocker is resolved through the dashboard.
- `SUPABASE_MASTER` remains absent from this runtime, but is no longer needed for release. Setup supports it for future administrative work, with `SUPABASE_ACCESS_TOKEN` as fallback. Keep both server-side.
- Real-backend RLS/CRUD/report/import tests and Chromium callback/recovery/refresh/save/reload/edit/delete/settings/import/sign-out/account-isolation checks passed. Temporary accounts were cleaned up, independently confirmed by SQL. The local production smoke check, build, 74 unit/PostgreSQL tests, and 8 mocked browser tests passed; built assets contain no configured privileged credentials.
- Publish through https://github.com/sigfriedjk/timesheet/pull/1. A merge to `main` triggers `.github/workflows/deploy.yml`, including the remote production browser smoke check. Use its run status and the production URL to establish deployment success; the pre-integration base commit listed above is historical.
- Email delivery still requires the user to request/open their own sign-in link. Verification sends no emails. This does not block release after URL configuration and live Auth sessions are verified.
- The remaining sections record earlier checkpoints; their missing-token/configuration/deployment blockers are historical and superseded by this section.

## Earlier checkpoint — October 21, 2026

- The user added a full-permission Management token named `SUPABASE_MASTER`. Fresh process checks and current runtime-status observations still show it absent/unlisted; the environment configuration must reach this runtime before it can be used. Setup now prefers `SUPABASE_MASTER`, then falls back to `SUPABASE_ACCESS_TOKEN`. Never print either value. Vite rejects Management-token literals and `VITE_SUPABASE_MASTER`/`VITE_SUPABASE_ACCESS_TOKEN` before bundling.
- Checked out `wip/supabase-integration-20261021` from GitHub. Production `main` is still `17d7bb8`.
- The current environment reports all Supabase variables ready, including `SUPABASE_ACCESS_TOKEN`, and enforces access to `api.supabase.com`, `*.supabase.co`, and production. Commands need `sandbox_permissions: with_additional_permissions` and `additional_permissions.network.enabled: true`. No credential values were printed.
- `npm run setup:supabase` successfully applied the migration through the supported Management database/query endpoint, then failed at Auth PATCH with HTTP 403: `Missing required permission(s): project_admin_write`. Auth GET succeeds; its Site URL is still `http://localhost:3000` and redirect allowlist is empty. The user has been asked to update token permissions or set the production Site URL/redirect in the dashboard. Do not work around the missing permission through database internals.
- Live privilege inspection found default `TRUNCATE`/other surplus grants on `authenticated`; `TRUNCATE` bypasses RLS. The migration now resets browser-role grants before granting CRUD, was reapplied live, and PostgreSQL confirms `TRUNCATE` is denied on both tables. A regression test covers broad preexisting grants and repeatability.
- The server key can administer Auth but lacks table SELECT in this project. The verifier now checks tables with a disposable authenticated client rather than broadening server-role grants. `npm run verify:supabase` passes against the real backend: two-user RLS, anonymous denial, CRUD, reports, imports, conflict preservation, rollback, and spoofed ownership. All temporary users from completed runs were deleted in `finally`.
- `npm ci --cache /workspace/.npm-cache`, **74 unit/PostgreSQL tests**, **8 mocked browser tests**, production build, and the production smoke script against `http://127.0.0.1:4173/` pass. Built artifacts were compared in memory with configured privileged credentials; no values or secret-key literals were found.
- Added optional real-backend Chromium verification: `SUPABASE_BROWSER_URL=http://127.0.0.1:4173/ npm run verify:supabase` after starting preview. It uses the ordinary sessions of the same two disposable accounts. Real Supabase requests are forwarded through undici using the runtime proxy and configured CA; TLS verification remains enabled, no trust-store changes occur, and no backend responses are mocked. No email is sent, and no browser trace/session artifacts are exported. This checks callback handling, but cannot establish email delivery or the currently incorrect production redirect allowlist.
- The complete real-backend Chromium run **passes**, including Auth callback/recovery, expired-session refresh, calculator save, persisted reload/edit/delete, leave settings, explicit import preserving browser originals/cloud conflicts, sign-out, and second-account isolation. Cleanup succeeded for both disposable users; an independent SQL count confirmed zero remaining `timesheet-verification-*@example.invalid` accounts.
- GitHub connector access is available for repository/PR/Actions operations. Shell `gh api` is blocked by the hostname policy because `api.github.com` is absent; use the connector rather than bypassing policy.

### Remaining release gate

1. Set Auth Site URL to `https://sigfriedjk.github.io/timesheet/`, add `https://sigfriedjk.github.io/timesheet/**` to redirects, and preserve unrelated redirect entries. The Management token needs `project_admin_write`, or the user can do this in the dashboard. Read configuration back to confirm.
2. The complete real-backend Chromium run has passed; independent SQL inspection confirmed zero remaining verification accounts.
3. Once ready, publish/merge to `main`, watch `.github/workflows/deploy.yml`, and verify production HTML/assets plus GitHub Actions' browser smoke report. Deployment is authorized; the WIP branch does not deploy.
4. The user must request/open their own sign-in email to confirm email delivery. Do not send sign-in emails on their behalf.

## Earlier resume findings — October 21, 2026 (superseded by current resume above)

- Checked out this branch in `/workspace/timesheet`; current production `main` remains `17d7bb8`.
- The new environment now exposes `SUPABASE_SECRET_KEY` and `SUPABASE_API_KEY`, and its network policy permits `*.supabase.co` and production. Actual requests through the configured proxy reach the project and production. Shell network commands still need the additional network permission described below. No credential values were printed.
- The project secret successfully authorizes the supported Auth admin API (HTTP 200). Public Auth settings return HTTP 200 with email enabled and signup permitted. Auth Site URL and redirect configuration cannot be established from that public endpoint.
- Both configured project keys reach the Data API, but querying `timesheet_logs` with `limit=0` returns HTTP 404 / `PGRST205`: the required table is still absent. `npm run verify:supabase` therefore stops at its initial schema check. No temporary users were created, and no remote mutations occurred.
- `SUPABASE_ACCESS_TOKEN` and PostgreSQL credentials are absent, and `api.supabase.com` is outside the current hostname policy. The project secret cannot apply SQL or configure Auth. Asked the user to either bind the Management token and allow that hostname, or apply the existing migration and Auth URL settings in the dashboard. Live RLS/CRUD/import verification and deployment remain gated on this setup.
- Reinstalled dependencies with `npm ci --cache /workspace/.npm-cache`; all **73 unit/PostgreSQL tests**, all **8 browser tests**, and the production build pass in this environment. The production smoke script also passes against `http://127.0.0.1:4173/` (Vite's preview serves this relative-base build at `/`, not `/timesheet/`). Sample mode makes zero Supabase requests. Scanned built assets in memory: no configured privileged credential values or secret key literals are present. The bare `sb_secret_` string legitimately appears in the SDK/config rejection logic; it is not evidence of a leaked key.
- Fixed `scripts/verify-production.mjs` to use undici's environment proxy agent, pass the configured proxy to Chromium, and honor `CHROME_PATH`. Reverified the full local smoke check after the change. Production HTML is reachable through undici; native Node fetch fails here because it does not inherit the proxy.
- Remote Chromium currently reports `ERR_CERT_AUTHORITY_INVALID` for the managed proxy. Automatic approval review rejected importing the configured proxy CA into the persistent Chromium NSS trust store because it broadens future TLS trust. No trust change was made and TLS checks were not disabled. Leave remote browser verification to the existing GitHub Actions deployment check, which runs without this environment's proxy, unless the user explicitly approves that trust change. Local Chromium verification is successful.

## User goal and security requirements

Use `@supabase/supabase-js` as the default personal-data store. Sample mode must remain fully client-side, work without signing in/offline, and never touch Supabase. Preserve calculator, calendar, monthly leave/forecast, and POP behavior. Keep existing personal browser records available for explicit, atomic, non-destructive import; existing cloud rows/settings take priority.

Project URL: `https://yiqquogdutgujsacoezh.supabase.co` (base URL, not `/rest/v1/`). Public browser configuration is in `src/config/supabasePublic.ts`, with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`/legacy `VITE_SUPABASE_ANON_KEY`, and Settings overrides.

Keep `SUPABASE_SECRET_KEY` server-side. Never print its value, put it in `VITE_*`, source, browser storage, bundles, screenshots, or committed configuration. A project secret normally authorizes privileged Data API/Auth admin calls. It is **not** a Management API access token or PostgreSQL connection password and does not grant arbitrary SQL execution. Determine actual authorization with supported APIs; do not invent SQL RPCs or misuse a project key as a Management token.

## Environment observations at handoff

Fresh process checks and the environment-status tool both still showed:

- `SUPABASE_SECRET_KEY`: absent; no Supabase-related process variables at all.
- Secret bindings: empty.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: present/nonempty (values never printed). `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_DEFAULT_REGION`: absent.
- Status listed only the AWS variables; their readiness was `unknown`.
- Restricted network policy listed package/GitHub presets plus `sigfriedjk.github.io`. The Supabase project hostname was absent. The status tool reported network policy state `unknown`; the local `/etc/codex/network-policy.json` had no Supabase rules and no VPN/TCP grants.
- Environment revision was 2. User was troubleshooting why the republished configuration had not reached this runtime.

For the new environment, bind the secret and allow **`yiqquogdutgujsacoezh.supabase.co`** explicitly (or a supported wildcard covering it). Adding the apex `supabase.co` may not cover its subdomains. If using the Management API, also allow **`api.supabase.com`** and bind a suitable **`SUPABASE_ACCESS_TOKEN`**. Alternatively, use authorized PostgreSQL credentials/connectivity or have the user run the migration in the SQL Editor and configure Auth in the dashboard.

Read the cloud-environment-runtime skill and current network policy before network work. Recheck status and credential presence without printing values. Never bypass destination restrictions. Shell network commands in this conversation required `sandbox_permissions: with_additional_permissions` with `additional_permissions.network.enabled: true`; without that, even the allowed GitHub proxy connection failed. This sandbox grant does not change destination policy. `npm ci --cache /workspace/.npm-cache` works.

## Completed implementation

- `src/App.tsx` now uses `useSupabaseConnection` and `useWorkspace`. Fresh normal visits select personal Supabase data; explicit sample query/Settings selection uses only the sample store. Previously selected sample mode still persists as before.
- Personal calculator/calendar/monthly/POP views wait for auth recovery and successful cloud loading. Load errors provide retry. No personal local-storage fallback.
- Account/source/project identity changes clear previous data and remount drafts. Late recovery/load/save results cannot repopulate a changed workspace or trigger stale success/navigation. Writes reject overlapping operations and use the latest snapshot.
- Calculator, day editor, month editor, deletes, leave settings, and import await persistence. Failure messages preserve drafts/dialogs; success/navigation happens only after acknowledgement; controls disable while saving.
- Auth clients are created in an effect only for personal mode. Auth events outrank late getSession results; StrictMode cleanup unsubscribes and calls the SDK's `auth.dispose()`, including after late initialization. The installed SDK is 2.118.x and supports dispose.
- Repository nullability/build errors fixed. History uses 500-row pages; requests include user scoping. Log/report writes require returned acknowledgements; delete requires a returned row. Notes can be cleared.
- Legacy report import normalizes old policy shape without mutating the browser original. Import uses the prepared security-invoker RPC; no automatic import or sample import.
- Added cloud access/setup/error styles and checked 390px/1280px screenshots. Sample controls remain in Settings.
- Vite fails before bundling recognized privileged values in `VITE_*` configuration. Only public browser configuration is imported by app source.
- README, architecture, and design docs explain cloud defaults, explicit migration, offline samples, and verification limits.

## Database and server-only tooling

`supabase/migrations/202610210001_timesheet.sql` is now **applied to the real project**. It creates `timesheet_logs`, `timesheet_reports`, owner RLS policies, timestamp triggers, and atomic `import_browser_timesheet`. It is repeatable and transactional. POP definitions are now account-owned private configuration; see PRIVATE_CONFIGURATION.md.

- `npm run setup:supabase`: server-only `scripts/setup-supabase.mjs`. Requires `SUPABASE_ACCESS_TOKEN`; reads Management API Auth config, runs the migration through the supported database/query endpoint, sets Site URL to `https://sigfriedjk.github.io/timesheet/`, merges `https://sigfriedjk.github.io/timesheet/**` into existing redirects, and reads config back. Does not use `SUPABASE_SECRET_KEY` as a SQL credential. Live migration succeeded; Auth PATCH failed because the token lacks `project_admin_write`.
- `npm run verify:supabase`: server-only `scripts/verify-supabase.mjs`. Requires the project secret/service-role binding, uses the configured proxy via undici, checks the Data API, creates two temporary confirmed Auth users (`timesheet-verification-*@example.invalid`) **without sending email**, and signs them in with normal public-key clients to test RLS/CRUD/import. Tests anonymous denial, cross-user read/write/delete denial, report preservation, import conflicts/rollback, and ignores spoofed import user IDs. Cleans up temporary users in finally. Failed cleanup explicitly requires dashboard inspection. It never reads existing personal rows for the initial capability check (`limit(0)`).
- The live script now passes with real disposable Auth users, including optional Chromium checks. All accounts were cleaned up. Earlier attempts in previous environments failed before setup; the current results supersede those observations.
- The browser Settings panel also provides SQL copy/download and manual Auth URL instructions. Do not send sign-in emails on the user's behalf. The user can request a magic link through the UI for a final email/redirect check.

## Verification completed locally

- `npm run build`: passed (TypeScript and Vite).
- `npm test`: **73 tests passed**, covering all 50 existing calculation/storage tests plus public config rejection, real supabase-js request behavior against mocked HTTP, pagination, report persistence, auth recovery/sign-out/account/project changes/StrictMode, workspace stale results/concurrency/failures/sample isolation/import, and SQL policies.
- `supabase/migration.test.ts` executes the real migration twice on embedded PostgreSQL (PGlite). It verifies anonymous table/RPC denial; two user identities under the authenticated role; cross-user reads/inserts/updates/deletes/report writes; ownership-changing writes; import ownership/conflict preservation; atomic rollback; and report-shape validation. This is actual local PostgreSQL execution with a small simulated auth schema, **not a real Supabase project/Auth verification**.
- `npm run test:browser`: **8 Chromium tests passed**. Real app + real SDK, mocked backend: unauthenticated gate, cloud load/session recovery, failed calculator/day/month/leave saves retaining drafts, retry/save/delete/sign-out behavior, offline sample calculator/calendar/monthly/POP/Settings with **zero Supabase requests**, 390px and 1280px layout. Config: `playwright.config.ts`; tests: `tests/browser/workspace.spec.ts`. Uses `/usr/bin/chromium`, optional `CHROME_PATH`, or Playwright's installed browser. No live backend claim.
- `scripts/verify-production.mjs` was updated to expect the sign-in gate and assert zero Supabase calls from sample views. Its normal/sample/Settings production smoke checks still need to be run against a local build and after deployment.
- Server-only setup/live scripts passed `node --check`. A synthetic `VITE_SUPABASE_PUBLISHABLE_KEY=sb_secret_...` build was correctly rejected before bundling.
- Disposable screenshots/profiles/results are under ignored `work/`; do not commit them.

## Next steps in the new conversation

1. Check out the branch and read this handoff. Confirm the correct new environment has the secret binding and hostname access, without printing values. Determine real administrative capabilities. If only the project secret is available, test Data API/Auth admin authorization, but obtain SQL/Management access separately or use the SQL Editor/dashboard.
2. Apply the migration with authorized SQL access and configure/verify Auth Site URL + redirect allowlist. Preserve existing unrelated redirects. Never run arbitrary SQL with a presumed secret-key capability.
3. Run the server-only live verifier, inspect/fix actual errors, and confirm all temporary users are cleaned up. Verify full auth session recovery, refresh, account switching, and real cloud read/write behavior. Have the user request/open their own magic link for email delivery/redirect verification; do not send emails yourself.
4. Run `npm ci --cache /workspace/.npm-cache`, `npm test`, `npm run build`, and `npm run test:browser` as needed for the new environment. Inspect any final diff and test gaps; the code has not had a separate reviewer. Browser/backend mocks cannot establish live readiness.
5. Run the updated production smoke script against a local built preview. Check browser credentials are public and no privileged secret is in generated assets (compare in memory without printing values).
6. Once live backend, Auth, browser, and build checks are satisfactory, merge/publish to `main`. Pushes to main trigger `.github/workflows/deploy.yml`; the WIP branch does not deploy automatically. Verify the Actions result and actual production URL/assets/sample isolation. Deployment is authorized when ready, not before verification.

## Existing behavior to preserve

Historical releases included account-specific configuration as public defaults. Those values are removed from the proposed application, tests, and documentation; old Git objects, browser caches, and previous deployments are not deleted by this change.

## Prompt to paste in the new conversation

Resume the Supabase integration in github.com/sigfriedjk/timesheet. Check out `wip/supabase-integration-20261021` and read `SUPABASE_HANDOFF.md` first. The new environment should expose `SUPABASE_SECRET_KEY` and permit the Supabase project hostname; check both without printing the secret. Keep privileged credentials server-side. Finish live database/Auth setup and verification using the credential's actual capabilities; a project secret is not a Management API token or arbitrary-SQL credential. The app builds and local unit/PostgreSQL/browser tests pass, but no schema/Auth changes or deployment have been made. Complete the remaining checks, then deploy when ready.
