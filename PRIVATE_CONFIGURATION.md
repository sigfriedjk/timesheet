# Private workspace configuration

Personal POP definitions and funded hours live in `timesheet_pop_settings.periods`. The PTO accrual rate lives in `timesheet_reports.state.settings.ptoAccrualRate`. Both tables require authentication and enforce `auth.uid() = user_id` through RLS. The public application contains no personal POP or rate defaults. New accounts have empty POPs and an unconfigured rate.

The sample is separate, explicitly fictional, and stored under new fictional-sample browser keys. Retired sample keys are not read or deleted. This preserves old browser data without reusing retired configuration as a current example or personal fallback.

## Units and calculation precision

`ptoAccrualRate` is **hours of PTO earned per one hour worked**, not a percentage. Valid configured values are finite numbers from 0 through 1 inclusive, with up to eight decimal places. Zero is an explicit valid rate; null or an absent field means unconfigured. The input validates entered precision before numeric conversion can hide extra digits. Database validation enforces the same numeric bounds and precision.

The stored rate multiplies entered work hours. Accrual still rounds to the nearest hundredth after multiplication. Recorded work rounds to tenths before adding future work, and recorded/planned leave retains its existing rounding order. Changing the rate recalculates all monthly PTO accruals; this change does not introduce effective-date rate schedules. Without a valid rate, work totals remain usable, while PTO accruals and leave balances show as unavailable with an explicit Settings message.

## Migration order and preservation

The additive `202610230001_private_workspace_configuration.sql` migration has been applied to the existing project. The operator confirmed the target account before the account-specific backfill. The backfill inserted only missing configuration, preserved the saved POP row, and did not alter time entries or other report settings. Repeating it made no changes. No private migration values, account identifiers, backups, or database dumps are committed.

`timesheet_seed_workspace_configuration` accepts explicit server-supplied inputs and is unavailable to anonymous or authenticated browser roles. Existing personalized POPs, including `[]`, always win over seed inputs. Existing configured rates, including zero, also win. A compatibility trigger preserves the stored rate when an older client saves report settings without that field. The existing restore RPC signature remains usable by older clients and preserves their omitted rate inside the restore transaction.

For an existing database, apply the new additive migration; do not rerun older migrations individually afterward, because they contain earlier versions of the replacement function. A fresh project runs all migrations in filename order. Schema setup contains no account-specific backfill values.

## Backup and restore

New exports use version 3 and include every saved input: logs and notes, report settings and the configured PTO rate, dated leave and adjustments, legacy report fields retained for compatibility, and the entire POP list. A complete export requires a valid rate. Current-file imports validate the rate and all sections before submitting a replacement.

Version 1/2 files and older log arrays remain supported. An absent legacy rate is never replaced with a code default: the database keeps the destination account's current configured rate, including zero, or rejects the restore before changing data if no rate exists. Omitted POP definitions preserve the current list; an explicitly empty list restores as empty. Missing report inputs retain the previous reset-to-default behavior apart from the preserved rate. The preview explains these rules before the existing replacement confirmation.

The replacement function resolves legacy configuration and replaces logs, report inputs, and POPs in one owner-scoped transaction. Invalid input rolls all sections back. Server-side validation remains necessary even after browser validation.

## Verification

- Embedded PostgreSQL tests cover migration repeatability, preservation of customized and empty POPs, existing zero rates, missing-only backfill, old-client saves, rate bounds/precision, RLS, current and legacy restore behavior, and atomic rollback.
- Unit tests cover validated input, complete/legacy backup formats, independent account rates, missing versus zero configuration, and calculation precision.
- Browser tests exercise missing configuration, rate editing and persistence, restore warnings/failure/retry, SQL setup download, and the existing application workflows.
- `npm run verify:supabase` uses disposable `example.invalid` accounts only, cleans them up, and exercises the actual application serializer/parser and repository for complete and legacy round trips, exact rate precision, empty POPs, RLS, and rollback. Its destructive restore checks refuse real accounts.
- Before removing embedded values, the migrated account's export was validated entirely in memory; its real workspace was never restored. Sixteen complete report comparisons across dates and year filters matched the previous calculations exactly. Destructive round trips used fictional temporary workspaces.
- `npm run build` followed by `node scripts/audit-private-configuration.mjs <pre-migration-git-ref>` scans current source and generated assets against the retired configuration in memory. It prints only file paths, match categories, and counts, never values. The audit does not embed private reference data in tests or public source.

## Remaining exposure and release boundary

Removing values from the current code and generated bundle does not remove copies already present in Git history, closed PR diffs, old build artifacts, previous deployments, browser caches, or retired local sample data. Other people may have copied public assets already. This work does not rewrite Git history, delete deployments, purge caches, or erase browser data.

The live application continues to serve the previous release until this PR is explicitly authorized for merge and deployment. The database migration is compatible with that release, but its public static defaults remain exposed until a cleaned release is deployed. Any later history cleanup or deployment deletion requires separate authorization; such cleanup cannot guarantee that prior copies disappear.
