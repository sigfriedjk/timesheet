import { useEffect, useMemo, useState } from 'react';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, saveSupabaseConfig, SupabaseConfig } from '../services/supabaseConfig';

export function useSupabaseConnection(enabled: boolean) {
  const [config, setConfig] = useState(getSupabaseConfig);
  const identity = useMemo(() => ({}), [enabled, config]);
  const [auth, setAuth] = useState<{
    identity?: object;
    config: SupabaseConfig | null;
    client: SupabaseClient | null;
    session: Session | null;
    ready: boolean;
    error: string;
  }>({ config: null, client: null, session: null, ready: false, error: '' });
  useEffect(() => {
    // Sample mode must not instantiate an SDK client, recover a session, or refresh tokens.
    if (!enabled || !config) return;
    const client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: true },
    });
    let active = true;
    let events = 0;
    setAuth({ identity, config, client, session: null, ready: false, error: '' });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      events++;
      if (active) setAuth({ identity, config, client, session, ready: true, error: '' });
    });
    const beforeRecovery = events;
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        // A late recovery must never restore an account after SIGNED_OUT/account change.
        if (active && events === beforeRecovery)
          setAuth({
            identity,
            config,
            client,
            session: data.session,
            ready: true,
            error: error?.message ?? '',
          });
      })
      .catch((error) => {
        if (active && events === beforeRecovery)
          setAuth({
            identity,
            config,
            client,
            session: null,
            ready: true,
            error: error instanceof Error ? error.message : 'Could not recover your sign-in.',
          });
      })
      .finally(() => {
        if (!active) {
          void client.auth.dispose();
          return;
        }
        void client.auth.startAutoRefresh().then(() => {
          if (!active) void client.auth.dispose();
        });
      });
    return () => {
      active = false;
      subscription.unsubscribe();
      void client.auth.dispose();
    };
  }, [enabled, config, identity]);
  const current = enabled && auth.identity === identity;
  return {
    config,
    client: current ? auth.client : null,
    session: current ? auth.session : null,
    authReady: !enabled || !config || (current && auth.ready),
    error: current ? auth.error : '',
    configure: (value: SupabaseConfig) => setConfig(saveSupabaseConfig(value)),
  };
}
export type SupabaseConnection = ReturnType<typeof useSupabaseConnection>;
