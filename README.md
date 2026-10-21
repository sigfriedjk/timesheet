# Work Hours Tracker Web Application

[![Codespaces CI & Build Validation](https://github.com/sigfriedjk/timesheet/actions/workflows/codespaces.yml/badge.svg)](https://github.com/sigfriedjk/timesheet/actions/workflows/codespaces.yml)
[![Deploy to GitHub Pages](https://github.com/sigfriedjk/timesheet/actions/workflows/deploy.yml/badge.svg)](https://github.com/sigfriedjk/timesheet/actions/workflows/deploy.yml)

🌐 **Live Application:** [https://sigfriedjk.github.io/timesheet/](https://sigfriedjk.github.io/timesheet/)  
💻 **Open in Codespaces:** [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/sigfriedjk/timesheet)

A dedicated, streamlined single-user time tracking web application designed to replace spreadsheet-based work logs with instant calculations, shift projections, and leave accrual management.

Hosted statically on **GitHub Pages** with **Node.js** (Vite + React + TypeScript), containerized with **Docker Desktop**, and architected for **Supabase** backend synchronization.

---

## Implemented Features

1. **Daily Calculator & Shift Projections (Interface 1):**
   * **Ephemeral Inputs:** In-memory calculation for `Date`, `Time In`, `Time Out` (optional), and `Break Duration (mins)`.
   * **Real-Time Live Projections:** Calculates current elapsed hours dynamically using the live clock if Time Out is blank ("*If you leave now, you will have X.X hours*").
   * **Shift Target Cards:** Instant forecasting for:
     * **8.0 hours** (Standard Shift)
     * **9.6 hours** (9/80 Long Shift)
     * **Custom Target** (User-adjustable goal)
     * Real-time progress bars, countdowns ("Xh Ym remaining"), and target departure times.
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
   * A 12-row year table with actual work, remaining work forecasts, trailing 12-month totals/averages, accrued leave, used/planned leave, and separate PTO/holiday/birthday balances.
   * An explicit actuals cutoff keeps future logs and projected work separate from recorded hours. Monthly work overrides and dated planned leave recalculate forecasts without changing daily logs.
   * **Settings → Leave & forecasts** configures opening balances/month, future work rate (94.3% by default), birthday month, and historical PTO gap-filling (enabled by default). Historical and forecast PTO cover weekday shortfalls after work and other leave, including empty months.
   * Work-hour and leave precision remain 0.1 and 0.01 hours respectively. Weekday hours in this table include holidays; holiday credits are tracked separately, following the reference workbook's structure.
   * Up to 12 tracked months are used for rolling averages, including empty tracked months as zero. Partial windows are labeled; the top rolling average uses completed months.

4. **POP Summary:**
   * A table modeled on the reference POP report: weekdays, weekday hours, funded hours, funded percentage, worked hours, and signed funded-minus-worked hours, with totals.
   * Settings lists 24 fixed, inclusive date ranges and funded amounts, named POP A–X. These definitions are shared across data sources; worked hours come only from the selected workspace's daily logs.
   * Filter by overlapping year or show all periods. Cross-year POPs retain their complete ranges and funding. An actuals cutoff excludes future logs; weekend and holiday work still counts.

5. **Domain Types & Architectural Scaffolding:**
   * Fully typed domain entities (`TimeLog`, `PeriodOfPerformance`, `LeaveAdjustment`).
   * Local-first persistence repository ready for Supabase client synchronization.
   * Navigation tabs for all 5 core application interfaces.

---

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

Open the Monthly Summary tab or use `?view=monthly` (`?sample=2026&view=monthly` for the sample workspace). Set **Actuals through** to the date through which logs and leave usage are considered actual. The sample defaults to October 20, 2026.

Opening balances default to zero at January of the current year (January 2026 for the sample). Enter the correct starting PTO, holiday, and birthday balances in Settings. Balances carry across years; the report shows unavailable balances before the configured opening month.

Click a month to add dated PTO, holiday, birthday, overhead, or signed PTO adjustment entries. Future dates are planned leave. The month editor also allows a total-work-hours forecast override for incomplete/future months; a zero override is supported, and completed months always use recorded work. Resetting sample data also resets only the sample report settings/leave entries/forecasts.

US federal credits are counted on observed weekdays to avoid double credit for actual and observed dates. Unworked observed holidays default to holiday usage; explicit holiday entries override that month's actual/planned portion. PTO earns 0.0851 hours per worked hour, holiday credits are granted at the start of their month, and birthday credit is 8 hours at the start of the configured month. Historical PTO automatically fills weekday gaps after work and other leave, including empty months. Explicit PTO entries (including zero) override the automatic amount. Existing report settings are migrated once to enable this policy while retaining balances, entries, and forecasts; later opt-outs in Settings persist. Forecast PTO covers future weekday shortfalls after other leave; balances can be negative.

## POP Summary

Open `?view=pop` or `?sample=2026&view=pop`. Fixed POP definitions live in `src/config/periodsOfPerformance.ts` and appear in **Settings → Periods of performance**. The 24 periods span April 25, 2024 through June 30, 2027, including mid-month and cross-year boundaries. Names are generic POP A–X; original aliases and the workbook's worked-hour amounts are not imported. Dates and funded amounts are hardcoded for now; editing periods in the interface is deferred.

The year filter selects full periods overlapping the selected year. Weekday hours include holidays, matching the reference: Monday–Friday days × 8. Funded percentage is funded hours divided by weekday hours; totals use a weighted percentage. Worked hours sum daily logs within the inclusive range through the actuals cutoff, including weekend and holiday shifts. Future logs and work projections are excluded. Funded-minus-worked hours remain signed so overruns are visible. Sample data through October 20, 2026 yields 1,915.0 funded hours, 1,210.7 worked hours, and 704.3 hours remaining across five 2026 POPs.
