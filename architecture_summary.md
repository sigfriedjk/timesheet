# Architecture Summary: GitHub Pages + Supabase (Serverless / Jamstack)

## 1. High-Level Summary
* **Frontend:** Hosted statically on **GitHub Pages**, built using **Node.js** (v22 LTS) toolchain with **React**, **TypeScript**, and **Vite**.
* **Development Environment:** Fully containerized with **Docker Desktop**. All Node.js builds, tests, dependencies, and development servers run inside Docker containers—requiring zero local host tool installations.
* **Backend / Database:** Managed **Supabase** (PostgreSQL + Built-in REST/GraphQL API + Auth Engine) as the default personal-data store through `@supabase/supabase-js`. Only the separate sample workspace uses local browser storage; legacy personal browser data is explicitly importable.
* **Infrastructure Overhead:** Zero server setup, zero container management in production, and no complex cloud infrastructure (no AWS Lambda, API Gateway, or DynamoDB configuration required).

---

## 2. Authentication Mechanism (Passwordless / Magic Link)
* **Client-Side Auth Flow:**
  1. The frontend invokes the Supabase JavaScript/TypeScript SDK: `supabase.auth.signInWithOtp({ email })`.
  2. Supabase handles email delivery, sending a secure, time-limited **Magic Link** to the user.
  3. Clicking the link redirects the user back to the GitHub Pages URL with access and refresh tokens attached in the URL hash fragment (`#access_token=...`).
  4. The client-side Supabase SDK parses the hash fragment, securely stores the **JSON Web Token (JWT)** in browser `localStorage`, and cleans up the URL.
* **Data Security & Authorization:**
  * Security is handled at the database level using PostgreSQL **Row Level Security (RLS)**.
  * All database read/write queries execute directly from client-side JavaScript via the SDK, passing the JWT in the HTTP headers.
  * RLS policies evaluate the token's user ID (e.g., `USING (auth.uid() = user_id)`) to enforce data isolation and access control.

---

## 3. Cost & Operational Profile
* **GitHub Pages:** Free static hosting with automated deployments from git.
* **Docker Desktop:** Free local development environment containerizing Node.js, Vite dev server, and test runners with zero host installs.
* **Supabase Free Tier ($0/month):**
  * **Database:** 500 MB PostgreSQL database.
  * **Auth:** Up to 50,000 Monthly Active Users (MAUs).
  * **Storage:** 1 GB file storage / 5 GB monthly database egress.
  * *Operational Note:* Free tier projects auto-pause after 7 days of inactivity (wakes up upon next access or via automated health ping).
* **Supabase Pro Tier ($25/month per project):**
  * Prevents auto-pausing.
  * Includes 8 GB database storage, 100,000 MAUs, and 100 GB storage.

---

## 4. Implementation Checklist
1. **Dockerized Node.js Environment:** Configure `docker-compose.yml` and container runner scripts for Node.js development, testing, and production Vite static builds.
2. **GitHub Pages Deployment:** Push static frontend build assets (from `dist/`) to the repository or deploy via GitHub Actions.
3. **Supabase Setup:** Create a project at [supabase.com](https://supabase.com) and retrieve public `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. **Auth Redirect Configuration:** In the Supabase Dashboard (*Authentication -> URL Configuration*), add the GitHub Pages deployment URL (e.g., `https://<username>.github.io/<repo>/`) to the allowed **Redirect URLs**.
5. **Database & RLS Setup:** 
   * Apply `supabase/migrations/202610210001_timesheet.sql`: `timesheet_logs`, `timesheet_reports`, owner policies, timestamp triggers, and an atomic import RPC. POP definitions remain shared static configuration.
   * Add a `user_id` column referencing `auth.users(id)`.
   * Enable **Row Level Security (RLS)** on all tables and create policies restricting CRUD operations to matching `auth.uid()`.


## 5. Persistence lifecycle and verification

Personal views are gated on session recovery and completed cloud loading. Repository reads page history in batches of 500 and scope queries by user; PostgreSQL RLS is the security boundary. Report JSON stores leave settings, entries, projections, and the PTO policy version. Every editor awaits acknowledgement before showing success or closing, and failures preserve drafts. Workspace identities reject stale loads/saves after source, account, or project changes. Sample mode never instantiates the SDK client or refreshes sessions.

Legacy personal browser data is never read as an automatic fallback. Explicit import uses a security-invoker transaction, inserts missing dates/settings only, and preserves browser originals. Privileged project keys are server-only verification tools; schema/Auth configuration requires Management API authorization or SQL/dashboard access. No arbitrary SQL capability is inferred from a project secret.

Local verification combines real SDK requests against mocked HTTP, hook lifecycle tests, embedded PostgreSQL RLS tests with two roles/identities, and Chromium UI tests. Live RLS/Auth/data checks and production verification remain separate release gates. See `SUPABASE_HANDOFF.md` for the observed state.
