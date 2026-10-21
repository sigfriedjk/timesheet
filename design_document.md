# Work Hours Tracker Web Application - Design Document

## 1. Overview and Objectives

The objective of this application is to replace an existing Google Sheets time-tracking workbook with a dedicated, streamlined web application. Designed exclusively for a single user, the application provides four core functional pillars:

1. **Today's Time Calculation & Projections:** Real-time calculation of time worked, estimated time-out, and future shift projections based on clock-in times and break durations.

2. **Time Logging:** Recording and storing daily work hours, allowing repeated logs on the same day to overwrite previous values.

3. **Calendar History View:** A 12-month calendar/table view highlighting weekends and US federal holidays for quick entry inspection and editing.

4. **Aggregated Reporting & Leave Tracking:** Dynamic reporting split into dedicated **Monthly Summaries** (including formulaic leave accrual and usage tracking) and customizable **Period of Performance (POP)** pivot views.

## 2. Core Design Requirements

* **Technology Stack (Node.js & Zero-Install Docker Environment):**
  * **Runtime & Toolchain:** Modern **Node.js** (v22 LTS) toolchain with **TypeScript**, **React**, and **Vite**.
  * **Containerized Development (Docker Desktop):** All development workflows (dev server, test suites, static build scripts) are fully containerized using **Docker Desktop** (via `docker-compose` or Docker runner). The host machine requires zero local runtime installations (no local Node.js, Python, or Git required on the host).
  * **Target Deployment:** Static web application deployed to GitHub Pages with Supabase as the default personal-data store and a separate offline sample workspace.

* **Precision & Rounding Rule (CRITICAL):** 
  * All work hours entered, calculated, and displayed are rounded and maintained to the **nearest tenth of an hour** ($0.1$).
  * All leave accruals and running leave balances are calculated and maintained to the **nearest hundredth of an hour** ($0.01$).

* **Single-User Architecture:** Personal logs and report state require Supabase Auth and owner-scoped PostgreSQL RLS. Sample data stays entirely in browser storage, needs no sign-in, and creates no Supabase client. Existing personal browser data remains available for explicit atomic import; cloud failures do not fall back to local storage.

* **Customizable Periods of Performance (POP):** Flexible creation and management of named POP ranges with custom start and end dates.

* **Streamlined Daily Logging:** The daily calculator operates in-memory; saving a daily entry awaits persistence, updates or overwrites the single historical log entry for that date, and transitions the user to the 12-Month Calendar view only on success. Failed saves preserve editor drafts and display an error.

* **Visual Calendar Distinction:** Visual distinction (color-coding) for weekends and standard US federal holidays.

## 3. Data Model

### Entity 1: `TimeLog` (Daily Entry)

Represents a saved daily record. *(Note: `timeIn`, `timeOut`, and `breakDuration` are ephemeral calculator inputs and are not persisted in the database).*

* `id` (UUID / String, Primary Key)

* `date` (Date string, `YYYY-MM-DD`, Unique Index)

* `totalHours` (Decimal / Float, rounded to nearest 0.1 hour, e.g., `8.0`, `9.6`)

* `notes` (String, optional remarks)

* `createdAt` (Timestamp)

* `updatedAt` (Timestamp)

### Entity 2: `PeriodOfPerformance` (POP)

Represents contract or billing performance periods used for aggregations.

* `id` (UUID / String, Primary Key)

* `name` (String, e.g., "POP 1 - Prime Contract")

* `startDate` (Date string, `YYYY-MM-DD`)

* `endDate` (Date string, `YYYY-MM-DD`)

* `targetHours` (Decimal / Float, optional target total hours for the period)

### Entity 3: `LeaveAdjustment`

Represents manual overrides or adjustments to the running leave balance for a given month (corresponding to column U in the spreadsheet).

* `id` (UUID / String, Primary Key)

* `date` (Date string, `YYYY-MM-DD` or `YYYY-MM`)

* `adjustmentHours` (Decimal / Float, rounded to nearest 0.01 hour)

* `reason` (String, description/notes for the adjustment)

* `createdAt` (Timestamp)

## 4. User Workflow

1. **Daily Tracking & Calculator View:**

   * User opens the app; fields default to the current date and time.

   * User enters ephemeral parameters (`Time In`, optional `Lunch/Break`, and optional target shift duration like 8.0 or 9.6 hours).

   * System dynamically calculates:

     * Current elapsed hours (rounded to 0.1).

     * Estimated completion time (`Time Out`) to hit targets.

     * Quick status: *"If you leave now, you will have X.X hours."*

2. **Logging Time (Workflow #2):**

   * Clicking **"Log Time"** saves the current date's total hours into the database.

   * **Overwrite Logic:** If an entry already exists for the selected date, the system prompts or automatically overwrites the `totalHours` for that day. This step can be re-run multiple times throughout the day as hours accumulate.

   * Upon successful saving, the app automatically transitions the user to the **12-Month Calendar View**.

3. **Future Projections:**

   * User selects a future date in the calculator tab, inputs planned start time and duration, and reviews projected weekly/monthly impact without forcing an overwrite until saved.

4. **Reporting & Navigation:**

   * User navigates between dedicated views: Calendar View, Monthly Summary View, POP Summary View, and POP Settings/Adjustments.

## 5. Description of Interfaces

### Interface 1: Daily Calculator & Projection Dashboard

* **Calculator Controls:** Inputs for `Date`, `Time In`, `Time Out` (optional), and `Break Duration (mins)`.

* **Live Target Card:** Real-time display showing target end times for 8.0, 9.6, or custom hour goals.

* **Log Action:** Prominent "Log Time" button that commits `totalHours` to `TimeLog` and redirects to Interface 2.

### Interface 2: 12-Month Calendar / History Interface

* **Layout:** Grid or multi-month layout capable of displaying a 12-month period in a single view or scrolled sequence.

* **Visual Highlights:**

   * **Weekends:** Grayed-out or subtle background tinting.

   * **US Federal Holidays:** Distinct color badge/highlight (e.g., soft blue or amber) with holiday labels (e.g., Memorial Day, Labor Day).

* **Inline Edits:** Clicking any date square allows direct editing or overwriting of `totalHours` and `notes`.

### Interface 3: Monthly Summary View

* **Comprehensive Monthly Table:** Displays row-by-row breakdown for each calendar month including leave accruals, holiday credits, and balance calculations.

* **Columns:**

  1. `Month / Year` (e.g., Jan 2026)

  2. `Work Days Count` (Number of logged non-zero days)

  3. `Total Hours Worked` (Sum of `TimeLog.totalHours` for the month, rounded to 0.1)

  4. `Accrued Worked Leave` ($0.0851 \times \text{Hours Worked}$, rounded to 0.01)

  5. `Holiday & Birthday Accrual` (Accrued holiday hours + 8.0 hrs on Jan 1st, rounded to 0.01)

  6. `Leave Adjustments` (Sum of manual entries from `LeaveAdjustment`, rounded to 0.01)

  7. `Used Leave` (Leave hours taken during the month, rounded to 0.01)

  8. `Net Leave Balance` (Cumulative running total of available leave, rounded to 0.01)

  9. `Variance vs Target` (Difference between worked hours and expected monthly target hours, rounded to 0.1)

### Interface 4: POP Pivot Summary View

* **POP Summary Table:** Aggregates logged time by inclusive Period of Performance ranges. The current release uses 24 fixed definitions, POP A–X, from April 25, 2024 through June 30, 2027. Settings displays the dates and funded amounts; interactive editing is deferred.

* **Columns:**

  1. `POP Name`

  2. `Date Range` (`Start Date` to `End Date`)

  3. `Weekdays` (Monday–Friday, including holidays)

  4. `Weekday Hours` (Weekdays × 8)

  5. `Funded Hours` (Fixed funding for the full period)

  6. `Funded %` (Funded hours ÷ weekday hours; total uses a weighted percentage)

  7. `Worked` (Sum of daily logs through the actuals cutoff, including weekend/holiday work, rounded to 0.1)

  8. `Funded − Worked` (Signed difference, rounded to 0.1; negative indicates an overrun)

The year filter selects full POPs overlapping that year without truncating cross-year ranges. All-years mode displays all 24 periods. Future logs and estimates are excluded from worked hours. Definitions are shared between personal and sample workspaces while worked hours remain isolated.

### Interface 5: POP & System Settings

* **POP Definitions:** Read-only table of the hardcoded dates and funded hours. A form to add, edit, or remove periods is deferred.

* **Leave Adjustments Manager:** Form to view and insert manual leave balance adjustments (corresponding to column U).

## 6. Calculations and Formulas

### Precision & Rounding Conventions

* **Work Hours Function:** 

  $$
  \text{ROUND}_{0.1}(x) = \frac{\text{ROUND}(x \times 10)}{10}
  $$

* **Leave Accrual Function:** 

  $$
  \text{ROUND}_{0.01}(x) = \frac{\text{ROUND}(x \times 100)}{100}
  $$

### 6.1 Ephemeral Shift Calculator Formulas

* **Worked Duration (Decimal Hours):**

  $$
  \text{Raw Hours} = \frac{(\text{TimeOut} - \text{TimeIn}) - \text{BreakMinutes}}{60}
  $$

* **Rounding to Nearest Tenth:**

  $$
  \text{Total Hours} = \text{ROUND}_{0.1}(\text{Raw Hours})
  $$

* **Estimated Time Out for Target Hours (**$H_{\text{target}}$**):**

  $$
  \text{Target Time Out} = \text{TimeIn} + H_{\text{target}} + \text{BreakMinutes}
  $$

### 6.2 Monthly View & Leave Accrual Formulas

1. **Monthly Total Hours Worked (**$H_{\text{month}}$**):**

   $$
   H_{\text{month}} = \text{ROUND}_{0.1}\left(\sum_{d \in \text{Month}} \text{TimeLog.totalHours}_d\right)
   $$

2. **Accrued Worked Leave (**$A_{\text{worked}}$**):**
   Fixed rate based on actual hours worked (calculated to nearest hundredth):

   $$
   A_{\text{worked}} = \text{ROUND}_{0.01}(0.0851 \times H_{\text{month}})
   $$

3. **Holiday & Birthday Accruals (**$A_{\text{special}}$**):**

   * **Holidays:** Holidays accrue on the **first day of the month** in which the federal holiday occurs (8.0 hours credited at the start of the month).

   * **Birthday Hours:** An additional 8.0 leave hours accrue on **January 1st** of each year.

   $$
   A_{\text{special}} = \text{ROUND}_{0.01}\left(\sum_{\text{Holidays in Month}} 8.0 + \begin{cases} 8.0, & \text{if Month} = \text{January} \\ 0.0, & \text{otherwise} \end{cases}\right)
   $$

4. **Monthly Ending Leave Balance (**$B_{\text{month}}$**):**

   $$
   B_{\text{month}} = \text{ROUND}_{0.01}\left(B_{\text{previous}} + A_{\text{worked}} + A_{\text{special}} + \text{Adjustment}_{\text{month}} - L_{\text{used}}\right)
   $$

   *Where* $\text{Adjustment}_{\text{month}}$ *represents the sum of `LeaveAdjustment` records for that month (column U).*

5. **Monthly Expected Target Hours (**$T_{\text{month}}$**):**

   $$
   T_{\text{month}} = \text{ROUND}_{0.1}(\text{WorkDaysInMonth} \times 8.0)
   $$

   *(Where* $\text{WorkDaysInMonth}$ *excludes weekends and recognized US holidays).*

6. **Monthly Work Variance (**$V_{\text{month}}$**):**

   $$
   V_{\text{month}} = \text{ROUND}_{0.1}(H_{\text{month}} - T_{\text{month}})
   $$

### 6.3 Period of Performance (POP) Pivot Formulas

1. **POP Total Logged Hours (**$H_{\text{POP}}$**):**

   $$
   H_{\text{POP}} = \text{ROUND}_{0.1}\left(\sum_{d \in [\text{POP.startDate}, \text{POP.endDate}]} \text{TimeLog.totalHours}_d\right)
   $$

2. **POP Remaining Target Hours (**$R_{\text{POP}}$**):**

   $$
   R_{\text{POP}} = \text{ROUND}_{0.1}(\text{POP.targetHours} - H_{\text{POP}})
   $$

3. **POP Completion Percentage (**$P_{\text{POP}}$**):**

   $$
   P_{\text{POP}} = \left( \frac{H_{\text{POP}}}{\text{POP.targetHours}} \right) \times 100\%
   $$

## Implemented Monthly Report Refinements

The monthly report follows the grouped work/accrued/entered/balance structure of the supplied leave worksheet. Its weekday-hours baseline includes holidays (`8 × Monday–Friday count`), with holiday credits and usage tracked separately. This differs from the calendar/sample 94% target baseline, which excludes observed holidays.

A selected actuals cutoff separates actual logs/leave from future plans. The default future work rate is 94.3% of eight-hour non-holiday weekdays; dated future daily logs replace individual day estimates, and monthly total-work overrides replace automatic forecasts. Planned leave reduces unlogged future work estimates. Projected PTO usage fills future weekday gaps after other leave.

Opening balances are configured at the start of a chosen month and carried across years. Historical PTO gaps are automatically filled by default after work and other leave, including empty months; explicit PTO entries, including zero, override the automatic amount. A versioned one-time migration enables this policy for existing report stores without losing balances, entries, or forecasts, while preserving subsequent opt-outs in Settings. Signed PTO adjustments and separate PTO/holiday/birthday/overhead entries are dated so future entries do not alter current balances. All report settings, entries, and forecasts are isolated between personal and sample stores. A sample reset resets only the sample report.

Rolling totals span trailing 12-month windows across years, rather than restarting in January. Partial history is labeled and is not silently padded with zero months before tracking started; empty months inside the tracked range count as zero. Annual totals sum flows, while December balances are closing values and are not summed.
