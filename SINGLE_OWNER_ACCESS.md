# Single-owner access

This deployment has one existing owner. Public registration and anonymous sign-in
are disabled in Supabase Auth. Email magic links remain enabled for that account.
The browser also sends `shouldCreateUser: false`; this is defense in depth, while
the server policy blocks direct password, OTP auto-creation, and anonymous signup.
There is no registration, invitation, or additional-user approval flow.

Existing owner RLS policies remain in force for logs, report settings, POPs, and
backup RPCs. Admission controls do not replace those policies. Workspace contents
and account credentials are unchanged. Sample mode still works without an account.

## Apply or verify the policy

`npm run lock:supabase` changes only these Management API settings:

```json
{"disable_signup": true, "external_anonymous_users_enabled": false}
```

It first requires exactly one confirmed email account that has signed in, checks
that email sign-in is enabled, then reads the policy back after applying it. It
refuses an empty or ambiguous account list instead of guessing or deleting users.
The normal `npm run setup:supabase` also enforces this policy before schema setup;
it never enables registration. These scripts require server-side
`SUPABASE_MASTER` or `SUPABASE_ACCESS_TOKEN` with database/query access and
`project_admin_write` for Auth updates.

If the Management API denies Auth updates, use the project dashboard:

1. In **Authentication → Users**, confirm your existing, confirmed account is the
   only user. Do not delete or recreate it; its ID owns the workspace.
2. In **Authentication → Sign In / Providers → User Signups** (some dashboard
   versions call this **Providers**), turn **Allow new users to sign up** off.
3. Keep **Allow anonymous sign-ins** off. Keep **Email** enabled and other
   providers disabled. Save the settings.
4. Preserve **URL Configuration**: Site URL
   `https://sigfriedjk.github.io/timesheet/` and redirect allowlist
   `https://sigfriedjk.github.io/timesheet/**`.
5. Run `npm run verify:admission` with the Management token and project secret to
   independently verify the server policy. Do not put those credentials in the app.

For a fresh project, an administrator must create only the intended owner's
confirmed account in the dashboard, and the owner must sign in once before
running the setup scripts. Do not enable public registration to bootstrap it.

## Verification and abuse limits

`npm run verify:admission` checks the live server settings, direct rejected signup
requests, and that the account count stays one. It generates a magic-link token
for the sole existing owner through the supported admin API **without emailing
it**, consumes it in memory, checks normal sign-in/session refresh and owner RLS
reads, and revokes only that temporary session. It does not save tokens, create
users, or write workspace data. It compares workspace hashes before and after
without printing rows, hashes, account identifiers, or emails. This updates Auth's
sign-in audit metadata; it does not test actual email delivery.

`npm run verify:supabase` performs destructive CRUD/restore tests using disposable
users. It now refuses to run when signup is disabled, before creating any users.
Use a separate staging project for that verifier. Embedded PostgreSQL tests still
check account isolation and atomic restores locally without real Auth accounts.

The live review found all alternate providers disabled. Existing provider-managed
rate limits were preserved: `rate_limit_email_sent=2`, `rate_limit_otp=30`,
`rate_limit_verify=30`, `rate_limit_token_refresh=150`. Review them under
**Authentication → Rate Limits**; keep the refresh allowance sufficient for normal
session recovery. Disabling registration prevents new accounts, but an attacker
who knows the owner's email can still attempt magic-link requests or consume
request/email quotas. Authentication rate limits continue to apply. There is no
public registration flow requiring a CAPTCHA in this change.

## Owner recovery

Use the existing email address for sign-in. Check spam, wait for the configured
email/request limits to reset, and request a fresh link if an earlier one expired.
If email access is lost, use the Supabase dashboard as project administrator to
update the email of the **same Auth user**, then confirm the new email and sign in.
Preserve its user ID; recreating the account can orphan or cascade-delete data.
Keep registration disabled throughout recovery. No client-side email allowlist or
public copy of the owner's identity is needed.

A project administrator/service-role credential can still create users or change
policy. Treat those credentials as administrative secrets. They are not exposed
to browsers, and ordinary callers cannot use them to bypass admission or RLS.
