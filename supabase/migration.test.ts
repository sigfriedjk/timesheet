import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let db: PGlite;
const report = { settings: { autoPto: false }, entries: [], projectedWork: {} };
async function asUser(user: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');`);
  const migration = readFileSync(new URL('./migrations/202610210001_timesheet.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Repeatability is part of the setup contract.
}, 30000);
afterAll(async () => { await db?.close(); });
describe('Migration on embedded PostgreSQL (local verification)', () => {
  it('denies anonymous tables and the import RPC', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.timesheet_logs')).rejects.toThrow('permission denied');
      await expect(db.query('select * from public.timesheet_reports')).rejects.toThrow('permission denied');
      await expect(db.query(`select public.import_browser_timesheet('[]')`)).rejects.toThrow('permission denied');
    } finally { await db.exec('reset role'); }
  });
  it('isolates reads, writes, deletes, reports and imports between two users', async () => {
    await asUser(A, `insert into public.timesheet_logs (date, total_hours) values ('2026-10-01', 8)`);
    await asUser(A, `insert into public.timesheet_reports (state) values ('${JSON.stringify(report)}')`);
    expect((await asUser(B, 'select * from public.timesheet_logs')).rows).toHaveLength(0);
    expect((await asUser(B, 'select * from public.timesheet_reports')).rows).toHaveLength(0);
    await expect(asUser(B, `insert into public.timesheet_logs (user_id, date, total_hours) values ('${A}', '2026-10-02', 9)`)).rejects.toThrow('row-level security');
    await expect(asUser(B, `insert into public.timesheet_reports (user_id, state) values ('${A}', '${JSON.stringify(report)}')`)).rejects.toThrow('row-level security');
    expect((await asUser(B, `update public.timesheet_logs set total_hours = 1 where user_id = '${A}' returning *`)).rows).toHaveLength(0);
    expect((await asUser(B, `delete from public.timesheet_logs where user_id = '${A}' returning *`)).rows).toHaveLength(0);
    expect((await asUser(B, `update public.timesheet_reports set state = '${JSON.stringify(report)}' where user_id = '${A}' returning *`)).rows).toHaveLength(0);
    await asUser(B, `select public.import_browser_timesheet('[{"user_id":"${A}","date":"2026-10-01","total_hours":3}]')`);
    expect((await asUser(B, 'select total_hours from public.timesheet_logs')).rows).toEqual([{ total_hours: '3.0' }]);
    expect((await asUser(A, 'select total_hours from public.timesheet_logs')).rows).toEqual([{ total_hours: '8.0' }]);
    await expect(asUser(A, `update public.timesheet_logs set user_id = '${B}'`)).rejects.toThrow('row-level security');
  });
  it('imports atomically, prefers existing cloud dates/settings, and is repeatable', async () => {
    const logs = '[{"date":"2026-10-01","total_hours":1},{"date":"2026-10-02","total_hours":7}]';
    const different = JSON.stringify({ ...report, settings: { autoPto: true } });
    expect((await asUser(A, `select public.import_browser_timesheet('${logs}', '${different}') as count`)).rows).toEqual([{ count: 1 }]);
    expect((await asUser(A, `select public.import_browser_timesheet('${logs}', '${different}') as count`)).rows).toEqual([{ count: 0 }]);
    expect((await asUser(A, `select total_hours from public.timesheet_logs order by date`)).rows).toEqual([{ total_hours: '8.0' }, { total_hours: '7.0' }]);
    expect((await asUser(A, 'select state from public.timesheet_reports')).rows).toEqual([{ state: report }]);
    await expect(asUser(A, `select public.import_browser_timesheet('[{"date":"2026-10-03","total_hours":6},{"date":"2026-10-04","total_hours":25}]')`)).rejects.toThrow('check constraint');
    expect((await asUser(A, `select * from public.timesheet_logs where date = '2026-10-03'`)).rows).toHaveLength(0);
  });
  it('validates report shape and requires a signed-in identity even for authenticated role', async () => {
    await expect(asUser(A, `update public.timesheet_reports set state = '{}'`)).rejects.toThrow('check constraint');
    await expect(asUser('', `select public.import_browser_timesheet('[]')`)).rejects.toThrow('Sign in');
  });
});
