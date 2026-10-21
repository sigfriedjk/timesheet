import { useEffect, useMemo, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import { getSupabaseConfig, saveSupabaseConfig, SupabaseConfig } from '../services/supabaseConfig';

export function useSupabaseConnection(enabled: boolean) {
  const [config, setConfig] = useState(getSupabaseConfig);
  const client = useMemo(() => enabled && config ? createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null, [enabled, config]);
  const [auth, setAuth] = useState<{ client: typeof client; session: Session | null; ready: boolean; error: string }>({ client: null, session: null, ready: false, error: '' });
  useEffect(() => {
    if (!client) return;
    client.auth.startAutoRefresh();
    let active = true;
    setAuth({ client, session: null, ready: false, error: '' });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setAuth({ client, session, ready: true, error: '' });
    });
    // The SDK emits INITIAL_SESSION once stored/redirect credentials are resolved.
    // Session recovery failures must also leave the loading state.
    void client.auth.getSession().then(({ data, error }) => {
      if (active) setAuth({ client, session: data.session, ready: true, error: error?.message ?? '' });
    }).catch(error => { if (active) setAuth({ client, session: null, ready: true, error: String(error.message || error) }); });
    return () => { active = false; subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
  }, [client]);
  return {
    config, client, session: auth.client === client ? auth.session : null,
    authReady: !client || (auth.client === client && auth.ready), error: auth.client === client ? auth.error : '',
    configure: (value: SupabaseConfig) => setConfig(saveSupabaseConfig(value)),
  };
}
export type SupabaseConnection = ReturnType<typeof useSupabaseConnection>;
