import React, { useState } from 'react';
import { SupabaseConnection } from '../hooks/useSupabaseConnection';
import { Workspace } from '../hooks/useWorkspace';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'The request could not be completed.';

export const SupabaseSignIn: React.FC<{ connection: SupabaseConnection }> = ({ connection }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="supabase-sign-in"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!connection.client || busy || !connection.authReady) return;
        setBusy(true);
        setStatus('');
        setError('');
        try {
          const redirect = new URL('.', window.location.href);
          const { error } = await connection.client.auth.signInWithOtp({
            email: email.trim(),
            options: { emailRedirectTo: redirect.href, shouldCreateUser: false },
          });
          if (error) throw error;
          setStatus('Check your email for a sign-in link. Open it to return to your timesheet.');
        } catch {
          setError('Could not send a sign-in link. Use your existing account email and try again shortly.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="form-label" htmlFor="supabase-email">
        Email
      </label>
      <div className="sample-actions">
        <input
          id="supabase-email"
          className="form-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={busy || !connection.authReady}
        />
        <button type="submit" className="btn-primary" disabled={busy || !connection.authReady}>
          {busy ? 'Sending…' : 'Email sign-in link'}
        </button>
      </div>
      <p className="settings-status" role="status">
        {status}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

export const SupabaseAccess: React.FC<{ connection: SupabaseConnection; workspace: Workspace }> = ({
  connection,
  workspace,
}) => (
  <section className="calculator-card supabase-access">
    <h2>{connection.session ? 'Your Supabase timesheet' : 'Sign in to your timesheet'}</h2>
    {!connection.config ? (
      <p>Connect your Supabase project in Settings to use your personal timesheet.</p>
    ) : !connection.authReady ? (
      <p role="status">Checking your sign-in…</p>
    ) : !connection.session ? (
      <>
        <p>Your personal hours and leave settings are saved in Supabase.</p>
        <SupabaseSignIn connection={connection} />
      </>
    ) : workspace.error ? (
      <>
        <p className="form-error" role="alert">
          {workspace.error}
        </p>
        <p>Check your connection and the database setup in Settings, then try again.</p>
        <button type="button" className="btn-primary" onClick={workspace.reload}>
          Retry loading data
        </button>
      </>
    ) : (
      <p role="status">Loading your timesheet…</p>
    )}
    {connection.error && (
      <p className="form-error" role="alert">
        {connection.error}
      </p>
    )}
  </section>
);

export const SupabaseAccountSettings: React.FC<{
  connection: SupabaseConnection;
  workspace: Workspace;
}> = ({ connection, workspace }) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="supabase-settings" aria-labelledby="supabase-settings-title">
      <h4 id="supabase-settings-title" className="card-title">
        Account & connection
      </h4>
      {connection.session ? (
        <div className="sample-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || workspace.busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const { error } = await connection.client!.auth.signOut({ scope: 'local' });
                if (error) throw error;
              } catch (error) {
                setError(message(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || workspace.busy || !workspace.ready}
            onClick={workspace.reload}
          >
            Reload Supabase data
          </button>
        </div>
      ) : !connection.authReady ? (
        <p>Checking your sign-in…</p>
      ) : connection.config ? (
        <SupabaseSignIn connection={connection} />
      ) : (
        <p>Enter your public connection details in Advanced project setup to sign in.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
