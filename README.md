# Work Hours Tracker Web Application

A dedicated, streamlined single-user time tracking web application designed to replace spreadsheet-based work logs with instant calculations, shift projections, and leave accrual management.

Hosted statically on **GitHub Pages** with **Node.js** (Vite + React + TypeScript), containerized with **Docker Desktop**, and architected for **Supabase** backend synchronization.

---

## 🚀 Key Features Implemented (Phase 1: Hello World & Daily Calculator)

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
   * Overview of recorded entries with weekend tinting and recognized US Federal Holidays.
   * Direct inline entry deletion and return to calculator for edits.

3. **Domain Types & Architectural Scaffolding:**
   * Fully typed domain entities (`TimeLog`, `PeriodOfPerformance`, `LeaveAdjustment`).
   * Local-first persistence repository ready for Supabase client synchronization.
   * Navigation tabs for all 5 core application interfaces.

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
    │   └── OtherViews.tsx       # Interfaces 3, 4, 5 previews & placeholders
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
