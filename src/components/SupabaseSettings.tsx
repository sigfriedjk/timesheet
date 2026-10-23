import React, { useState } from 'react';
import { SupabaseConnection } from '../hooks/useSupabaseConnection';
import { Workspace } from '../hooks/useWorkspace';
import baseSql from '../../supabase/migrations/202610210001_timesheet.sql?raw';
import workspaceSql from '../../supabase/migrations/202610220001_complete_workspace.sql?raw';
const setupSql = `${baseSql}\n${workspaceSql}`;

const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

export const SupabaseSignIn: React.FC<{ connection: SupabaseConnection }> = ({ connection }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  return <form className="supabase-sign-in" onSubmit={async event => {
    event.preventDefault();
    if (!connection.client || busy || !connection.authReady) return;
    setBusy(true); setStatus(''); setError('');
    try {
      const redirect = new URL('.', window.location.href);
      const { error } = await connection.client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect.href } });
      if (error) throw error;
      setStatus('Check your email for a sign-in link. Open it to return to your timesheet.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }}>
    <label className="form-label" htmlFor="supabase-email">Email</label>
    <div className="sample-actions"><input id="supabase-email" className="form-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy || !connection.authReady} /><button type="submit" className="btn-primary" disabled={busy || !connection.authReady}>{busy ? 'Sending…' : 'Email sign-in link'}</button></div>
    <p className="settings-status" role="status">{status}</p>{error && <p className="form-error" role="alert">{error}</p>}
  </form>;
};

export const SupabaseAccess: React.FC<{ connection: SupabaseConnection; workspace: Workspace }> = ({ connection, workspace }) => <section className="calculator-card supabase-access">
  <h2>{connection.session ? 'Your Supabase timesheet' : 'Sign in to your timesheet'}</h2>
  {!connection.config ? <p>Connect your Supabase project in Settings to use your personal timesheet.</p>
    : !connection.authReady ? <p role="status">Checking your sign-in…</p>
    : !connection.session ? <><p>Your personal hours and leave settings are saved in Supabase.</p><SupabaseSignIn connection={connection} /></>
    : workspace.error ? <><p className="form-error" role="alert">{workspace.error}</p><p>Check your connection and the database setup in Settings, then try again.</p><button type="button" className="btn-primary" onClick={workspace.reload}>Retry loading data</button></>
    : <p role="status">Loading your timesheet…</p>}
  {connection.error && <p className="form-error" role="alert">{connection.error}</p>}
</section>;

export const SupabaseSettings: React.FC<{ connection: SupabaseConnection; workspace: Workspace }> = ({ connection, workspace }) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="supabase-settings" aria-labelledby="supabase-settings-title">
    <h4 id="supabase-settings-title" className="card-title">Account & connection</h4>
    {connection.session ? <div className="sample-actions">
      <button type="button" className="btn-secondary" disabled={busy || workspace.busy} onClick={async () => {
        setBusy(true); setError('');
        try { const { error } = await connection.client!.auth.signOut({ scope: 'local' }); if (error) throw error; }
        catch (error) { setError(message(error)); } finally { setBusy(false); }
      }}>Sign out</button>
      <button type="button" className="btn-secondary" disabled={busy || workspace.busy || !workspace.ready} onClick={workspace.reload}>Reload Supabase data</button>
    </div> : !connection.authReady ? <p>Checking your sign-in…</p>
      : connection.config ? <SupabaseSignIn connection={connection} />
      : <p>Enter your public connection details in Advanced project setup to sign in.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
};

export const SupabaseProjectSettings: React.FC<{ connection: SupabaseConnection; disabled: boolean }> = ({ connection, disabled }) => {
  const [url, setUrl] = useState(connection.config?.url ?? '');
  const [key, setKey] = useState(connection.config?.publishableKey ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try { await action(); } catch (error) { setError(message(error)); } finally { setBusy(false); }
  };
  return <section className="calculator-card project-settings" aria-labelledby="project-settings-title">
    <details className="supabase-setup settings-disclosure"><summary><h3 id="project-settings-title" className="card-title">Advanced project setup</h3></summary>
      <p className="settings-description">Connection details are saved for this browser. Changing the project loads a different personal timesheet and may require signing in again. It does not move your data.</p>
      <form onSubmit={event => { event.preventDefault(); setError(''); setStatus(''); try { connection.configure({ url, publishableKey: key }); setStatus('Project connection saved for this browser.'); } catch (error) { setError(message(error)); } }}>
        <fieldset className="async-fields" disabled={disabled}><div className="report-settings-grid">
          <label>Project URL<input className="form-input" type="url" name="supabaseUrl" value={url} onChange={event => setUrl(event.target.value)} required /></label>
          <label>Publishable or legacy anon key<input className="form-input" type="password" name="supabaseKey" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required /></label>
        </div>
        <p className="settings-description">These are public browser credentials. Secret and service-role keys cannot be used here.</p>
        <button type="submit" className="btn-secondary">Save project connection</button></fieldset>
      </form>
      <ol className="setup-steps"><li>Run the SQL below once in your project’s SQL Editor to create the tables and per-user access policies.</li><li>In Authentication → URL Configuration, set Site URL to <code>https://sigfriedjk.github.io/timesheet/</code> and add <code>https://sigfriedjk.github.io/timesheet/**</code> to Redirect URLs.</li><li>Use an email sign-in link in Account & connection. A new timesheet account is created the first time you sign in.</li></ol>
      <div className="sample-actions"><button type="button" className="btn-secondary" onClick={() => void run(async () => { await navigator.clipboard.writeText(setupSql); setStatus('SQL setup copied. Paste it into the Supabase SQL Editor and run it.'); })}>Copy SQL setup</button><button type="button" className="btn-secondary" onClick={() => { const href = URL.createObjectURL(new Blob([setupSql], { type: 'text/plain' })); const link = document.createElement('a'); link.href = href; link.download = 'timesheet-supabase-setup.sql'; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); }}>Download SQL setup</button></div>
      <pre className="setup-sql"><code>{setupSql}</code></pre>
    </details>
    <p role="status" className="settings-status">{busy ? 'Working…' : status}</p>{error && <p className="form-error" role="alert">{error}</p>}
  </section>;
};
