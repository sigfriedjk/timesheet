// Server-only: never import this file from src/ or expose its environment to Vite.
// Verifies the deployed schema with ordinary signed-in clients, not an RLS-bypassing key.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici';

const projectUrl = process.env.SUPABASE_URL || 'https://yiqquogdutgujsacoezh.supabase.co';
const publicSource = await readFile(new URL('../src/config/supabasePublic.ts', import.meta.url), 'utf8');
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || publicSource.match(/DEFAULT_SUPABASE_PUBLISHABLE_KEY = '([^']+)'/)[1];
const secret = process.env.SUPABASE_SECRET_KEY;
const managementToken = process.env.SUPABASE_ACCESS_TOKEN;
console.log(`SUPABASE_SECRET_KEY: ${secret ? 'present' : 'absent'}`);
console.log(`SUPABASE_ACCESS_TOKEN: ${managementToken ? 'present' : 'absent'}`);
if (!secret) throw new Error('Live verification needs a server-side project secret/service-role key to create and clean up two temporary Auth users. No credential value was printed.');
if (!secret.startsWith('sb_secret_')) {
  let role;
  try { role = JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString()).role; } catch { /* Proxy-bound credentials may be opaque; probe supported APIs normally. */ }
  if (role && role !== 'service_role') throw new Error('SUPABASE_SECRET_KEY contains a non-administrative JWT.');
}
console.log('Testing project Data API/Auth admin capabilities only; no SQL or Management API authorization is inferred from this credential.');
const dispatcher = new EnvHttpProxyAgent();
const fetch = (url, init) => proxyFetch(url, { ...init, dispatcher });
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } };
const admin = createClient(projectUrl, secret, options);
const check = (result, operation) => { if (result.error) throw new Error(`${operation} failed (${result.error.code || result.error.status || 'unknown'}). Inspect project setup; response bodies and tokens are intentionally omitted.`); return result.data; };
const created = [];
const report = { ptoPolicyVersion: 1, settings: { openingMonth: '2026-01', openingPto: 0, openingHoliday: 0, openingBirthday: 0, workPercent: 100, autoPto: true }, entries: [], projectedWork: {} };
try {
  // The admin key is needed only for temporary Auth users. Do not assume it has
  // table privileges, or broaden grants just to accommodate a verification tool.
  const clients = [];
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const email = `timesheet-verification-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Auth admin createUser').user;
    assert.ok(user); created.push(user.id);
    const client = createClient(projectUrl, publicKey, options);
    sessions.push(check(await client.auth.signInWithPassword({ email, password }), 'Temporary user sign-in').session);
    clients.push(client);
  }
  console.log('Project key authorizes Auth admin user creation; two normal user sessions established.');
  const [a, b] = clients; const [aId, bId] = created;
  for (const table of ['timesheet_logs', 'timesheet_reports', 'timesheet_pop_settings']) {
    check(await a.from(table).select('user_id').limit(0), `${table} schema/data API check`);
  }
  console.log('Logs, report inputs and POP settings are available to a normal authenticated client.');
  const anonymous = createClient(projectUrl, publicKey, options);
  for (const table of ['timesheet_logs', 'timesheet_reports', 'timesheet_pop_settings']) {
    const result = await anonymous.from(table).select('*').limit(1);
    assert.ok(result.error || result.data?.length === 0, 'Anonymous data access must be denied');
  }
  assert.ok((await anonymous.rpc('import_browser_timesheet', { p_logs: [] })).error, 'Anonymous import must be denied');
  assert.ok((await anonymous.rpc('replace_timesheet_workspace', { p_logs: [], p_report: report, p_periods: [] })).error, 'Anonymous replacement must be denied');
  check(await a.from('timesheet_logs').insert({ user_id: aId, date: '2026-10-01', total_hours: 8 }), 'Own log insert');
  check(await a.from('timesheet_reports').insert({ user_id: aId, state: report }), 'Own report insert');
  assert.deepEqual(check(await b.from('timesheet_logs').select('*').eq('user_id', aId), 'Cross-user log read'), []);
  assert.deepEqual(check(await b.from('timesheet_reports').select('*').eq('user_id', aId), 'Cross-user report read'), []);
  assert.ok((await b.from('timesheet_logs').insert({ user_id: aId, date: '2026-10-02', total_hours: 9 })).error, 'Cross-user insert must fail');
  assert.ok((await b.from('timesheet_reports').upsert({ user_id: aId, state: report })).error, 'Cross-user report write must fail');
  assert.deepEqual(check(await b.from('timesheet_logs').update({ total_hours: 1 }).eq('user_id', aId).select(), 'Cross-user update'), []);
  assert.deepEqual(check(await b.from('timesheet_logs').delete().eq('user_id', aId).select(), 'Cross-user delete'), []);
  const imported = check(await a.rpc('import_browser_timesheet', { p_logs: [{ date: '2026-10-01', total_hours: 1 }, { date: '2026-10-02', total_hours: 7 }], p_report: { ...report, settings: { ...report.settings, openingPto: 99 } } }), 'Browser import');
  assert.equal(imported, 1);
  assert.equal(check(await a.from('timesheet_logs').select('total_hours').eq('date', '2026-10-01').single(), 'Import conflict check').total_hours, 8);
  assert.deepEqual(check(await a.from('timesheet_reports').select('state').single(), 'Report conflict check').state, report);
  assert.ok((await a.rpc('import_browser_timesheet', { p_logs: [{ date: '2026-10-03', total_hours: 6 }, { date: '2026-10-04', total_hours: 25 }] })).error, 'Invalid import must fail');
  assert.deepEqual(check(await a.from('timesheet_logs').select('*').eq('date', '2026-10-03'), 'Import rollback check'), []);
  check(await b.rpc('import_browser_timesheet', { p_logs: [{ user_id: aId, date: '2026-10-01', total_hours: 3 }] }), 'User-scoped import');
  const own = check(await b.from('timesheet_logs').select('user_id,total_hours').single(), 'Import owner check');
  assert.equal(own.user_id, bId); assert.equal(own.total_hours, 3);
  check(await a.from('timesheet_logs').update({ total_hours: 9 }).eq('date', '2026-10-01').select().single(), 'Own log update');
  check(await a.from('timesheet_logs').delete().eq('date', '2026-10-02').select().single(), 'Own log delete');
  console.log('Live schema, two-user RLS, anonymous denial, CRUD, report persistence, import conflict preservation, and atomic rollback verified.');
  const periods = [{ id: 'verification', name: 'Verification POP', startDate: '2026-01-01', endDate: '2026-12-31', targetHours: 1800 }];
  check(await a.from('timesheet_pop_settings').upsert({ user_id: aId, periods }), 'Own POP save');
  assert.deepEqual(check(await b.from('timesheet_pop_settings').select('*').eq('user_id', aId), 'Cross-user POP read'), []);
  assert.ok((await b.from('timesheet_pop_settings').upsert({ user_id: aId, periods: [] })).error, 'Cross-user POP write must fail');
  assert.deepEqual(check(await b.from('timesheet_pop_settings').update({ periods: [] }).eq('user_id', aId).select(), 'Cross-user POP update'), []);
  assert.deepEqual(check(await b.from('timesheet_pop_settings').delete().eq('user_id', aId).select(), 'Cross-user POP delete'), []);
  assert.ok((await a.from('timesheet_pop_settings').update({ user_id: bId }).eq('user_id', aId)).error, 'POP ownership changes must fail');
  const restoredReport = { ...report, settings: { ...report.settings, openingPto: 12, autoPto: false },
    entries: ['pto', 'holiday', 'birthday', 'overhead', 'adjustment'].map((category, i) => ({ id: category, date: '2026-10-05', category, hours: i === 4 ? -1.25 : i + 1, notes: `Verification ${category}` })), projectedWork: { '2026-11': 120 } };
  const replacement = { p_logs: [{ user_id: bId, date: '2026-10-01', total_hours: 9, notes: 'Replaced verification entry' }], p_report: restoredReport, p_periods: periods };
  assert.equal(check(await a.rpc('replace_timesheet_workspace', replacement), 'Complete workspace replacement'), 1);
  assert.deepEqual(check(await a.from('timesheet_reports').select('state').single(), 'Replaced report inputs').state, restoredReport);
  assert.deepEqual(check(await a.from('timesheet_pop_settings').select('periods').single(), 'Replaced POP settings').periods, periods);
  assert.equal(check(await a.from('timesheet_logs').select('user_id').single(), 'Replaced log ownership').user_id, aId);
  assert.ok((await a.rpc('replace_timesheet_workspace', { ...replacement, p_logs: [{ date: '2026-10-06', total_hours: 25 }], p_periods: [] })).error, 'Invalid replacement must roll back');
  assert.ok((await a.rpc('replace_timesheet_workspace', { ...replacement, p_logs: [], p_report: {} })).error, 'Invalid report must roll back');
  assert.deepEqual(check(await a.from('timesheet_reports').select('state').single(), 'Replacement rollback report').state, restoredReport);
  assert.deepEqual(check(await a.from('timesheet_pop_settings').select('periods').single(), 'Replacement rollback POPs').periods, periods);
  assert.equal(check(await a.from('timesheet_logs').select('total_hours').single(), 'Replacement rollback log').total_hours, 9);
  assert.equal(check(await b.from('timesheet_logs').select('total_hours').single(), 'Replacement account isolation').total_hours, 3);
  console.log('Live POP ownership and complete workspace replacement verified, including every leave category, forecast inputs, spoofed-owner denial, rollback, and account isolation.');
  if (process.env.SUPABASE_BROWSER_URL) {
    const { verifyLiveBrowser } = await import('./verify-live-browser.mjs');
    await verifyLiveBrowser({ site: process.env.SUPABASE_BROWSER_URL, sessions, fetch });
  }
} finally {
  const cleanup = await Promise.allSettled(created.map(async id => check(await admin.auth.admin.deleteUser(id), 'Temporary user cleanup')));
  await dispatcher.close();
  if (cleanup.some(result => result.status === 'rejected')) throw new Error('Temporary Auth user cleanup failed. Inspect the timesheet-verification-* accounts in the project dashboard.');
  console.log(`Cleaned up all ${created.length} temporary Auth users and their cascading timesheet rows.`);
}
