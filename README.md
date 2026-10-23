# Work Hours Tracker Web Application

[![Codespaces CI & Build Validation](https://github.com/sigfriedjk/timesheet/actions/workflows/codespaces.yml/badge.svg)](https://github.com/sigfriedjk/timesheet/actions/workflows/codespaces.yml)
[![Deploy to GitHub Pages](https://github.com/sigfriedjk/timesheet/actions/workflows/deploy.yml/badge.svg)](https://github.com/sigfriedjk/timesheet/actions/workflows/deploy.yml)

🌐 **Live Application:** [https://sigfriedjk.github.io/timesheet/](https://sigfriedjk.github.io/timesheet/)  
💻 **Open in Codespaces:** [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/sigfriedjk/timesheet)

A dedicated, streamlined single-user time tracking web application designed to replace spreadsheet-based work logs with instant calculations, shift projections, and leave accrual management.

Hosted statically on **GitHub Pages** with **Node.js** (Vite + React + TypeScript), containerized with **Docker Desktop**, and using **Supabase** as the default personal-data store.

---

## Implemented Features

1. **Daily Calculator & Shift Projections (Interface 1):**
   * **Ephemeral Inputs:** In-memory calculation for `Date`, `Time In`, `Time Out` (required), and `Break Duration (mins)`, which defaults to zero. Preset buttons set the break value; typing rounds up to a six-minute increment on blur. Shift labels sit beside their fields; compact time entries such as `1025` normalize to `10:25` on blur.
   * **Real-Time Live Projections:** The Live Calculation card shows elapsed work using the current clock. Saving a shift requires its entered Time Out. The Out Target card’s **Use as Time Out** button copies its displayed time into Entry Creator.
   * **Out Target:** A combined hours/time-out pair includes a directional control pointing toward the editable field. The other field calculates from Time In and the break duration. Calculated hours for an entered departure time round down to the nearest tenth. Switching direction lets you enter either desired hours or a departure time, and **Use as Time Out** copies the displayed departure time into Entry Creator.
   * **Mandatory Precision & Rounding Rules:**
     * Work hours strictly maintained to the **nearest tenth of an hour** ($0.1$).
     * Leave accrual formulas prepared to the **nearest hundredth of an hour** ($0.01$).
   * **Single-Click Time Logging & Overwrite Logic:**
     * Repeated logs on the same date cleanly update/overwrite the single historical entry.
     * Ephemeral calculator inputs remain in-memory; only the final date, rounded total hours, and notes are committed.
     * Automatic transition to the 12-Month Calendar view upon save (with user toggle).

2. **12-Month Calendar & History View (Interface 2):**
   * Responsive January–December grid, including empty months, with weekend tinting and actual/observed US Federal Holidays calculated for the selected year.
   * Compact yearly counts and monthly hour totals, with streamlined month cards showing the month name, hours, and date grid.
   * Click a date to add or edit total hours and notes; delete entries from the history table.
   * Isolated 2026 sample workspace with 149 entries, CSV/JSON downloads, reset, and a switch back to personal logs.

3. **Monthly Work & Leave Summary:**
   * A continuous month/year table, defaulting to All Years, with actual work, remaining work forecasts, trailing 12-month totals, collapsible accrued leave, used/planned leave, and separate PTO/holiday/birthday balances. Numbers omit trailing decimal zeros across Monthly Summary, the 12-month Calendar, and POP Summary.
   * Today’s date keeps future logs and projected work separate from recorded hours. Monthly work overrides and dated planned leave recalculate forecasts without changing daily logs.
   * **Settings → Leave & forecasts** configures opening balances/month, future work rate (94.3% by default), and historical PTO gap-filling (enabled by default). Birthday credit is always in January. Historical and forecast PTO cover weekday shortfalls after work and other leave, including empty months.
   * Work-hour and leave precision remain 0.1 and 0.01 hours respectively. Weekday hours in this table include holidays; holiday credits are tracked separately, following the reference workbook's structure.
   * Up to 12 tracked months are used for rolling averages, including empty tracked months as zero. Partial windows are labeled; the top rolling average uses completed months.

4. **POP Summary:**
   * A table modeled on the reference POP report: weekdays, weekday hours, funded hours, funded percentage, worked hours, and signed funded-minus-worked hours, with totals.
   * Settings lets you add, edit, and delete POP names, inclusive date ranges, and funded hours. Each account and the separate sample workspace starts with 24 defaults, POP A–X; changes are isolated to the selected workspace and included in backups.
   * Filter by overlapping year or show all periods. Cross-year POPs retain their complete ranges and funding. Today’s date excludes future logs; weekend and holiday work still counts.

5. **Domain Types & Architectural Scaffolding:**
   * Fully typed domain entities (`TimeLog`, `PeriodOfPerformance`, `LeaveAdjustment`).
   * Supabase Auth and user-scoped persistence for personal logs and report state; sample data remains local.
   * Navigation tabs for all 5 core application interfaces.

---

## Supabase personal data

Fresh visits use the configured Supabase project and require an email sign-in link before opening personal views. Browser credentials are public publishable/legacy anon keys; database RLS enforces per-user access. Sample mode creates no Supabase client and works without signing in or a network connection.

Run all SQL files in `supabase/migrations/` in filename order in the Supabase SQL Editor, then set Auth Site URL to `https://sigfriedjk.github.io/timesheet/` and allow `https://sigfriedjk.github.io/timesheet/**`. Preserve other redirect entries. For local magic-link testing, also allow the local application URL. The server-only `npm run setup:supabase` script applies these repeatable migrations in order and configures production Auth URLs using `SUPABASE_MASTER` when present, otherwise `SUPABASE_ACCESS_TOKEN`. The Management token needs database/query access and `project_admin_write` for Auth configuration changes. A project `SUPABASE_SECRET_KEY` is **not** a Management API token or PostgreSQL password and cannot substitute for arbitrary SQL execution.

Public defaults are in `src/config/supabasePublic.ts`; override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`), or Settings. Privileged credentials must stay in the execution environment. Never place a secret/service-role key, Management API token, or database password in `VITE_*`, source, browser storage, screenshots, or logs. Vite rejects recognized privileged browser configuration before bundling.

Existing personal browser data is preserved. After signing in, use **Settings → Import existing browser data** explicitly. One transactional RPC imports missing dates/report state, preserves existing cloud rows/settings, and leaves browser originals intact. Cloud write failures remain visible in the editor; they never fall back to local personal storage. Account, project, and source changes clear previous data and drafts.

**Settings → Import & export JSON** exports a version 2 backup of every saved input: daily date/hours/notes, POP names/dates/funding, dated PTO/Holiday/Birthday/Overhead/PTO-adjustment entries and notes, opening balances/month, work-rate percentage, automatic PTO inference, and manual monthly projections. Monthly balances, accruals, and totals are recalculated, and birthday credit is fixed to January. Calculator helper inputs, credentials, and sessions are excluded.

JSON import **replaces all data in the selected workspace**. Choose a file, review its section counts, check the explicit replacement confirmation, then click **Import JSON**. Personal replacement uses one owner-scoped database transaction; any failure rolls back all sections. Sample replacement writes one complete local snapshot and never touches Supabase. Version 1 backups and older log arrays remain accepted, with a warning that omitted report/settings and POP data reset to defaults. A version 2 file must include all sections, including explicit empty lists. Exported backups identify the workspace to prevent accidental sample/personal mixing. Export a backup first to keep current data. The separate **Import existing browser data** migration remains non-destructive, and previous browser records can also be exported before sign-in.

Verification:

- `npm test`: calculation/storage, real SDK request contracts, auth/workspace lifecycle, and embedded PostgreSQL migration/RLS/import tests.
- `npm run test:browser`: Chromium UI tests with mocked backend responses, including failure recovery, sample isolation, and desktop/mobile layout. Set `CHROME_PATH` if necessary, or install Chromium with Playwright.
- `npm run verify:supabase`: **live** project verification using a server-side `SUPABASE_SECRET_KEY`. Creates and cleans up two temporary confirmed Auth users without sending email; uses their ordinary sessions to verify RLS, CRUD, and imports. Requires the project host in the environment network policy. This does not configure schema or verify real email delivery.
- `SUPABASE_BROWSER_URL=http://127.0.0.1:4173/ npm run verify:supabase`: also exercises the built app against the real backend in Chromium (start `npm run preview` first). Checks Auth callback/recovery/refresh, cloud saves/reloads/edits/deletes, settings, explicit browser import, sign-out, and account isolation. Real backend traffic uses the server's configured proxy and CA with TLS verification; no backend responses are mocked. Temporary sessions use a disposable browser context with no exported session artifacts, emails, or browser traces. Email delivery and the production redirect allowlist require separate verification.
- `node scripts/verify-production.mjs [URL]`: static assets, unauthenticated access gate, sample calendar/monthly/POP, Settings, and no sample Supabase requests.

See `SUPABASE_HANDOFF.md` for current deployment readiness. Local mocked/embedded tests alone do not establish live backend readiness.

## 2026 Sample Data

Open [the sample calendar](https://sigfriedjk.github.io/timesheet/?sample=2026) or select **2026 sample data** under **Settings → Data source**. Sample entries use a separate browser storage key; editing, deleting, or resetting them does not change personal logs. The selected workspace persists across reloads. Select **My data** in Settings to return to personal logs.

The deterministic sample covers January 1 through October 20, 2026 with 149 logged days and 1,210.7 hours. February and August are empty; July 13–17 is a week off. It includes scattered days off, worked and unworked holidays, a Saturday shift, and daily hours from 6.0 to 10.0. Populated full months test just-below, exact, and just-above rounded 94% targets; October is partial. Unlogged dates indicate absent entries, not explicit leave records.

In Settings, expand **2026 sample data coverage & downloads** to download the original sample as CSV or JSON. Monthly and POP summaries use these same logs.

---

## 🐳 Zero-Install Development with Docker Desktop

This repository is designed to run completely inside **Docker Desktop**. You do **not** need to install Node.js, npm, or Git on your host system.

### 1. Start Development Server
```bash
docker compose up
```
The application will be live at `http://localhost:5173` with hot module replacement (HMR).

### 2. Run Test Suite
```bash
docker compose run --rm test
```
Runs the Vitest unit test suite validating all precision rules, calculation edge cases, and overwrite storage logic.

### 3. Build for Production / GitHub Pages
```bash
docker run --rm -v "${PWD}:/workspace" -w /workspace node:22-alpine sh -c "npm install && npm run build"
```
Outputs static production assets to `./dist/`, ready for direct deployment to GitHub Pages.

---

## 📁 Repository Structure

```
├── .github/                 # GitHub Actions CI/CD workflows
├── architecture_summary.md  # Jamstack, Supabase & GitHub Pages architecture
├── design_document.md       # Core product design document & calculation formulas
├── docker-compose.yml       # Docker Desktop orchestration
├── Dockerfile               # Node.js 22 LTS container definition
├── index.html               # Web application entrypoint
├── package.json             # Node.js project manifest & scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration (base: './' for GitHub Pages)
└── src/
    ├── App.tsx              # Main application coordinator & view router
    ├── index.css            # Responsive design system & styles
    ├── main.tsx             # React DOM entrypoint
    ├── components/
    │   ├── DailyCalculator.tsx  # Interface 1: Daily calculator & target projections
    │   ├── CalendarView.tsx     # Interface 2: Calendar & historical log table
    │   ├── Navigation.tsx       # Header tab navigation
    │   └── PopSummaryView.tsx   # Funded versus worked hours by POP
    ├── services/
    │   ├── storage.ts       # Local-first persistence repository (with overwrite logic)
    │   └── storage.test.ts  # Persistence & overwrite unit tests
    ├── types/
    │   └── index.ts         # Domain entities (TimeLog, POP, LeaveAdjustment)
    └── utils/
        ├── calculations.ts      # Core mathematical formulas & 0.1 rounding rules
        └── calculations.test.ts # Vitest suite for calculations & precision
```

---

## 📐 Formulas & Precision Conventions

* **Work Hours Function:**
  $$\text{ROUND}_{0.1}(x) = \frac{\text{ROUND}(x \times 10)}{10}$$

* **Worked Duration:**
  $$\text{Raw Hours} = \frac{(\text{TimeOut} - \text{TimeIn}) - \text{BreakMinutes}}{60}$$

* **Target Time Out:**
  $$\text{Target Time Out} = \text{TimeIn} + H_{\text{target}} + \text{BreakMinutes}$$

* **Leave Accrual Function:**
  $$\text{ROUND}_{0.01}(x) = \frac{\text{ROUND}(x \times 100)}{100}$$
  $$A_{\text{worked}} = \text{ROUND}_{0.01}(0.0851 \times H_{\text{month}})$$

## Monthly Summary Workflow

Open the Monthly Summary tab or use `?view=monthly` (`?sample=2026&view=monthly` for the sample workspace). Monthly and POP summaries automatically use the current local date for actual work and leave, including in sample mode. Open reports refresh at midnight and when returning to the tab. All Years is the default period; use the year selector to narrow the view. Each row includes its month and year. The current month is highlighted in amber and future months in blue. The range starts at the earliest opening month, log, leave entry, or work override and extends through the end of the latest saved/current year, including empty months. The two cards stay anchored to today: prior month-end PTO/holiday/birthday balances on the left and the current month’s first six work metrics on the right. Both summary tables display every row and use page scrolling vertically.

Opening balances default to zero at January of the current year (January 2026 for the sample). Enter the correct starting PTO, holiday, and birthday balances in Settings. Balances carry across years; the report shows unavailable balances before the configured opening month.

Click a month’s pencil to open a compact inline form for its saved PTO, holiday, birthday, overhead, and signed PTO adjustment totals. These fields exclude automatic estimates. Blank clears that month/category’s entered values; an explicit zero is saved and overrides automatic historical PTO/holiday inference. Changes retain existing dated records and notes where possible; increases use today’s date for the current month, month-end for completed months, or the first day for future months. Existing work-forecast overrides remain in the data. Use **Show accrued / Hide accrued** to toggle the three accrual columns. Resetting sample data resets only the sample report settings/leave entries/forecasts.

US federal credits are counted on observed weekdays to avoid double credit for actual and observed dates. Unworked observed holidays default to holiday usage; explicit holiday entries override that month's actual/planned portion. PTO earns 0.0851 hours per worked hour, holiday credits are granted at the start of their month, and birthday credit is 8 hours at the start of the configured month. Historical PTO automatically fills weekday gaps after work and other leave, including empty months. Explicit PTO entries (including zero) override the automatic amount. Existing report settings are migrated once to enable this policy while retaining balances, entries, and forecasts; later opt-outs in Settings persist. Forecast PTO covers future weekday shortfalls after other leave; balances can be negative.

## POP Summary

Open `?view=pop` or `?sample=2026&view=pop`. Fixed POP definitions live in `src/config/periodsOfPerformance.ts` and appear in **Settings → Periods of performance**. The 24 periods span April 25, 2024 through June 30, 2027, including mid-month and cross-year boundaries. Names are generic POP A–X; original aliases and the workbook's worked-hour amounts are not imported. Dates and funded amounts are hardcoded for now; editing periods in the interface is deferred.

All Years is selected by default. The year filter selects full periods overlapping the selected year. Weekday hours include holidays, matching the reference: Monday–Friday days × 8. Funded percentage is funded hours divided by weekday hours; totals use a weighted percentage. Worked hours sum daily logs within the inclusive range through today, including weekend and holiday shifts. Future logs and work projections are excluded. Funded-minus-worked hours remain signed so overruns are visible. Sample data through October 20, 2026 yields 1,915.0 funded hours, 1,210.7 worked hours, and 704.3 hours remaining across five 2026 POPs.
