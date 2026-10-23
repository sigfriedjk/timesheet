import { SupabaseConnection } from '../../hooks/useSupabaseConnection';
import { Workspace } from '../../hooks/useWorkspace';
import { SupabaseAccountSettings } from '../SupabaseAccount';

interface Props {
  isSample: boolean;
  connection: SupabaseConnection;
  workspace: Workspace;
  onUsePersonal: () => void;
  onUseSample: () => void;
}

function sourceStatus({ isSample, connection, workspace }: Props): string {
  if (workspace.error) return 'Could not load your timesheet.';
  if (!isSample) {
    if (connection.error) return 'Could not verify your sign-in.';
    if (!connection.config) return 'Configure a project in Advanced project setup.';
    if (!connection.authReady) return 'Checking your sign-in…';
    if (!connection.session) return 'Sign in to load My data.';
  }
  if (!workspace.ready) return 'Loading your timesheet…';
  if (workspace.busy) return 'Saving changes…';
  return 'Ready';
}

export function DataSourceSettings(props: Props) {
  const { isSample, connection, workspace, onUsePersonal, onUseSample } = props;
  const project = connection.config ? new URL(connection.config.url).host : 'No project configured';
  return (
    <section className="calculator-card data-source-settings" aria-labelledby="data-source-title">
      <h3 id="data-source-title" className="card-title">
        Data source
      </h3>
      <fieldset className="dataset-selector" disabled={workspace.busy}>
        <legend className="sr-only">Choose personal or sample data</legend>
        <label className="dataset-option">
          <input
            type="radio"
            name="dataset"
            value="personal"
            checked={!isSample}
            onChange={onUsePersonal}
          />
          <span>
            <strong>My data · Supabase</strong>
            <small>Personal timesheet saved to your signed-in account.</small>
          </span>
        </label>
        <label className="dataset-option">
          <input
            type="radio"
            name="dataset"
            value="sample2026"
            checked={isSample}
            onChange={onUseSample}
          />
          <span>
            <strong>2026 sample data · This browser</strong>
            <small>Separate, editable example data.</small>
          </span>
        </label>
      </fieldset>
      <p className="settings-description">
        {isSample
          ? 'Using 2026 sample data. Settings and edits apply only to this browser’s sample workspace. Your personal timesheet is separate.'
          : 'Using My data. Settings and edits apply to your signed-in Supabase account.'}
        {' Switching sources does not copy data between them.'}
      </p>
      <dl className="source-context">
        {!isSample && (
          <>
            <div>
              <dt>Account</dt>
              <dd>{connection.session?.user.email ?? 'Not signed in'}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{project}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Status</dt>
          <dd role="status">{sourceStatus(props)}</dd>
        </div>
      </dl>
      {workspace.error && (
        <>
          <p className="form-error" role="alert">
            {workspace.error}
          </p>
          <button type="button" className="btn-secondary" onClick={workspace.reload}>
            Retry loading data
          </button>
        </>
      )}
      {!isSample && connection.error && (
        <p className="form-error" role="alert">
          {connection.error}
        </p>
      )}
      {!isSample && <SupabaseAccountSettings connection={connection} workspace={workspace} />}
    </section>
  );
}
