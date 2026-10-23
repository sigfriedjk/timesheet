import React, { useState } from 'react';
import { SupabaseConnection } from '../../hooks/useSupabaseConnection';
import { downloadText } from '../../utils/download';
import baseSql from '../../../supabase/migrations/202610210001_timesheet.sql?raw';
import workspaceSql from '../../../supabase/migrations/202610220001_complete_workspace.sql?raw';
const setupSql = `${baseSql}\n${workspaceSql}`;

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'The request could not be completed.';

export const SupabaseProjectSettings: React.FC<{
  connection: SupabaseConnection;
  disabled: boolean;
}> = ({ connection, disabled }) => {
  const [url, setUrl] = useState(connection.config?.url ?? '');
  const [key, setKey] = useState(connection.config?.publishableKey ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="calculator-card project-settings" aria-labelledby="project-settings-title">
      <details className="supabase-setup settings-disclosure">
        <summary>
          <h3 id="project-settings-title" className="card-title">
            Advanced project setup
          </h3>
        </summary>
        <p className="settings-description">
          Connection details are saved for this browser. Changing the project loads a different
          personal timesheet and may require signing in again. It does not move your data.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            setStatus('');
            try {
              connection.configure({ url, publishableKey: key });
              setStatus('Project connection saved for this browser.');
            } catch (error) {
              setError(message(error));
            }
          }}
        >
          <fieldset className="async-fields" disabled={disabled}>
            <div className="report-settings-grid">
              <label>
                Project URL
                <input
                  className="form-input"
                  type="url"
                  name="supabaseUrl"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                />
              </label>
              <label>
                Publishable or legacy anon key
                <input
                  className="form-input"
                  type="password"
                  name="supabaseKey"
                  autoComplete="off"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  required
                />
              </label>
            </div>
            <p className="settings-description">
              These are public browser credentials. Secret and service-role keys cannot be used
              here.
            </p>
            <button type="submit" className="btn-secondary">
              Save project connection
            </button>
          </fieldset>
        </form>
        <ol className="setup-steps">
          <li>
            Run the SQL below once in your project’s SQL Editor to create the tables and per-user
            access policies.
          </li>
          <li>
            In Authentication → URL Configuration, set Site URL to{' '}
            <code>https://sigfriedjk.github.io/timesheet/</code> and add{' '}
            <code>https://sigfriedjk.github.io/timesheet/**</code> to Redirect URLs.
          </li>
          <li>
            Use an email sign-in link in Account & connection. A new timesheet account is created
            the first time you sign in.
          </li>
        </ol>
        <div className="sample-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void run(async () => {
                await navigator.clipboard.writeText(setupSql);
                setStatus('SQL setup copied. Paste it into the Supabase SQL Editor and run it.');
              })
            }
          >
            Copy SQL setup
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              downloadText('timesheet-supabase-setup.sql', setupSql, 'text/plain');
            }}
          >
            Download SQL setup
          </button>
        </div>
        <pre className="setup-sql">
          <code>{setupSql}</code>
        </pre>
      </details>
      <p role="status" className="settings-status">
        {busy ? 'Working…' : status}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
