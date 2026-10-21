import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fail before bundling if a privileged credential is accidentally exposed to Vite.
  const browserEnv = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('VITE_'))) };
  for (const [name, value = ''] of Object.entries(browserEnv)) {
    let privilegedJwt = false;
    try { privilegedJwt = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* Public modern keys are not JWTs. */ }
    if (/secret|service_role|password/i.test(name) || value.startsWith('sb_secret_') || privilegedJwt) {
      throw new Error(`Refusing to expose privileged credentials through ${name}. Use public browser credentials only.`);
    }
  }
  return {
  plugins: [react()],
  base: './', // Ensures relative assets work cleanly on GitHub Pages
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true, // Useful inside Docker on Windows
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'supabase/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
  } as any;
});
