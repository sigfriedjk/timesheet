// Server-only: Management credentials must never enter the browser build.
import { EnvHttpProxyAgent, fetch } from 'undici';

export function createManagementClient() {
  const token = process.env.SUPABASE_MASTER || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Use SUPABASE_MASTER or SUPABASE_ACCESS_TOKEN for the Management API, or configure the project in the Supabase dashboard. A project secret key cannot substitute.');
  const dispatcher = new EnvHttpProxyAgent();
  return {
    async request(path, method = 'GET', body) {
      const response = await fetch(`https://api.supabase.com/v1/projects/yiqquogdutgujsacoezh/${path}`, {
        dispatcher, method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const permission = response.status === 403 && path === 'config/auth' && method === 'PATCH'
          ? ' Auth configuration requires project_admin_write. Use the dashboard instructions in SINGLE_OWNER_ACCESS.md or update the Management token permissions.' : '';
        throw new Error(`Management API ${method} ${path} returned HTTP ${response.status}.${permission} Credentials and response body omitted.`);
      }
      return response.json();
    },
    close: () => dispatcher.close(),
  };
}
