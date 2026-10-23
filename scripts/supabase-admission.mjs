// No account identifiers or emails are returned or written by this policy check.
export async function requireExistingOwner(request) {
  const [summary] = await request('database/query', 'POST', { query: `
    select count(*)::int as accounts,
      count(*) filter (where email is not null and email_confirmed_at is not null
        and last_sign_in_at is not null)::int as established_accounts
    from auth.users` });
  if (summary?.accounts !== 1 || summary?.established_accounts !== 1)
    throw new Error('Expected exactly one confirmed account that has signed in. Review Authentication → Users before changing admission; no account details were printed.');
}

export async function configureSingleOwnerAuth(request) {
  await requireExistingOwner(request);
  const auth = await request('config/auth');
  if (auth.external_email_enabled !== true)
    throw new Error('Email sign-in must remain enabled for the existing owner. Review the Auth configuration before continuing.');
  if (auth.disable_signup !== true || auth.external_anonymous_users_enabled !== false) {
    await request('config/auth', 'PATCH', {
      disable_signup: true,
      external_anonymous_users_enabled: false,
    });
  }
  const verified = await request('config/auth');
  if (verified.disable_signup !== true || verified.external_anonymous_users_enabled !== false || verified.external_email_enabled !== true)
    throw new Error('Single-owner Auth policy readback failed. Verify the dashboard settings before release.');
  console.log('Verified: one established account; new signups disabled; anonymous sign-ins disabled; existing email sign-in enabled.');
}
