import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
// Entirely fictional configuration, unrelated to the migrated account.
const periods = [
  {
    id: 'comet',
    name: 'Fictional comet phase',
    startDate: '2035-02-03',
    endDate: '2035-02-16',
    targetHours: 13.75,
  },
];
const report = (rate: number | null = 0.125) => ({
  ptoPolicyVersion: 1,
  settings: {
    openingMonth: '2035-01',
    openingPto: 7,
    openingHoliday: 3,
    openingBirthday: 2,
    workPercent: 100,
    ptoAccrualRate: rate,
  },
  entries: [
    { id: 'fictional-leave', date: '2035-02-05', category: 'pto', hours: 1.25, notes: 'Fictional' },
  ],
  projectedWork: { '2035-03': 17 },
});
let db: PGlite;
async function asUser(user: string, sql: string, parameters: unknown[] = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  try {
    return await db.query(sql, parameters);
  } finally {
    await db.exec('reset role');
  }
}
async function seed(user = A, state = report(), pops = periods) {
  return db.query('select public.timesheet_seed_workspace_configuration($1, $2, $3) as result', [
    user,
    JSON.stringify(pops),
    JSON.stringify(state),
  ]);
}
async function snapshot(user = A) {
  const state = (
    await db.query('select state from public.timesheet_reports where user_id = $1', [user])
  ).rows;
  const pops = (
    await db.query('select periods from public.timesheet_pop_settings where user_id = $1', [user])
  ).rows;
  const logs = (
    await db.query(
      'select date::text, total_hours, notes from public.timesheet_logs where user_id = $1 order by date',
      [user],
    )
  ).rows;
  return { state, pops, logs };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');`);
  const directory = new URL('./migrations/', import.meta.url);
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(new URL(file, directory), 'utf8'));
  }
  await db.exec(
    readFileSync(new URL('202610230001_private_workspace_configuration.sql', directory), 'utf8'),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    'truncate public.timesheet_logs, public.timesheet_reports, public.timesheet_pop_settings',
  );
});
afterAll(async () => {
  await db?.close();
});

describe('Private workspace configuration migration', () => {
  it('fills missing configuration and is repeatable without replacing existing inputs', async () => {
    expect((await seed()).rows).toEqual([{ result: { popInserted: true, rateInserted: true } }]);
    const before = await snapshot();
    expect((await seed(A, report(0.25), [])).rows).toEqual([
      { result: { popInserted: false, rateInserted: false } },
    ]);
    expect(await snapshot()).toEqual(before);
  });

  it.each([{ pops: periods }, { pops: [] }])(
    'preserves personalized POPs, including an explicitly empty list: %j',
    async ({ pops }) => {
      const original = report(0);
      await asUser(A, 'insert into public.timesheet_reports(state) values ($1)', [
        JSON.stringify(original),
      ]);
      await asUser(A, 'insert into public.timesheet_pop_settings(periods) values ($1)', [
        JSON.stringify(pops),
      ]);
      const before = await snapshot();
      await seed();
      expect(await snapshot()).toEqual(before);
    },
  );

  it('fills only the missing rate and protects it from saves by the currently deployed client', async () => {
    const legacy = report() as ReturnType<typeof report> & {
      settings: { ptoAccrualRate?: number | null };
    };
    const { ptoAccrualRate: _rate, ...settings } = legacy.settings;
    const oldState = { ...legacy, settings };
    await asUser(A, 'insert into public.timesheet_reports(state) values ($1)', [
      JSON.stringify(oldState),
    ]);
    await asUser(A, 'insert into public.timesheet_pop_settings(periods) values ($1)', ['[]']);
    await asUser(
      A,
      "insert into public.timesheet_logs(date, total_hours, notes) values ('2035-02-05', 3.5, 'Keep')",
    );
    await seed();
    expect((await snapshot()).state).toEqual([
      { state: { ...oldState, settings: { ...settings, ptoAccrualRate: 0.125 } } },
    ]);
    const before = await snapshot();
    await asUser(A, 'update public.timesheet_reports set state = $1', [JSON.stringify(oldState)]);
    expect(await snapshot()).toEqual(before);
  });

  it('keeps rates and POPs under owner RLS and denies the server-only seed function to browsers', async () => {
    await seed(A, report(0.125));
    await seed(B, report(0.25), []);
    expect((await asUser(A, 'select state from public.timesheet_reports')).rows).toEqual([{ state: report(0.125) }]);
    expect((await asUser(B, 'select state from public.timesheet_reports')).rows).toEqual([{ state: report(0.25) }]);
    expect(
      (await asUser(A, 'select state from public.timesheet_reports where user_id = $1', [B])).rows,
    ).toEqual([]);
    expect(
      (await asUser(A, 'select periods from public.timesheet_pop_settings where user_id = $1', [B]))
        .rows,
    ).toEqual([]);
    expect(
      (
        await asUser(
          A,
          'update public.timesheet_reports set state = $1 where user_id = $2 returning *',
          [JSON.stringify(report(0)), B],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      asUser(A, 'select public.timesheet_seed_workspace_configuration($1, $2, $3)', [
        B,
        '[]',
        JSON.stringify(report()),
      ]),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(A, 'insert into public.timesheet_reports(user_id, state) values ($1, $2)', [
        B,
        JSON.stringify(report()),
      ]),
    ).rejects.toThrow();
    await db.exec('set role anon');
    try {
      await expect(db.query('select state from public.timesheet_reports')).rejects.toThrow(
        'permission denied',
      );
    } finally {
      await db.exec('reset role');
    }
  });

  it('accepts exact rate precision and rejects malformed, out-of-range, or over-precision rates', async () => {
    for (const rate of [0, 1, 0.00000001, 0.12345678]) {
      await asUser(
        A,
        'insert into public.timesheet_reports(state) values ($1) on conflict (user_id) do update set state = excluded.state',
        [JSON.stringify(report(rate))],
      );
      expect((await snapshot()).state).toEqual([{ state: report(rate) }]);
    }
    for (const rate of [-0.1, 1.1, 0.123456789, '0.25', false]) {
      const invalid = { ...report(), settings: { ...report().settings, ptoAccrualRate: rate } };
      await expect(
        asUser(A, 'update public.timesheet_reports set state = $1', [JSON.stringify(invalid)]),
      ).rejects.toThrow('check constraint');
    }
  });

  it('restores all sections atomically and retains configured zero and empty POPs for legacy files', async () => {
    await seed(A, report(0), []);
    const { ptoAccrualRate: _rate, ...settings } = report().settings;
    const legacy = { ...report(), settings };
    await asUser(A, 'select public.replace_timesheet_workspace($1, $2, $3)', [
      '[{"date":"2035-02-06","total_hours":4.2,"notes":"Restore"}]',
      JSON.stringify(legacy),
      null,
    ]);
    expect((await snapshot()).state).toEqual([
      { state: { ...legacy, settings: { ...settings, ptoAccrualRate: 0 } } },
    ]);
    expect((await snapshot()).pops).toEqual([{ periods: [] }]);
    const before = await snapshot();
    await expect(
      asUser(A, 'select public.replace_timesheet_workspace($1, $2, $3)', [
        '[{"date":"2035-02-07","total_hours":25}]',
        JSON.stringify(report(0.25)),
        JSON.stringify(periods),
      ]),
    ).rejects.toThrow('check constraint');
    expect(await snapshot()).toEqual(before);
    await asUser(A, 'select public.replace_timesheet_workspace($1, $2, $3)', [
      '[]',
      JSON.stringify(report(0.25)),
      JSON.stringify(periods),
    ]);
    expect((await snapshot()).state).toEqual([{ state: report(0.25) }]);
    expect((await snapshot()).pops).toEqual([{ periods }]);
    expect((await snapshot()).logs).toEqual([]);
  });

  it('rejects a legacy restore without an existing rate before changing any data', async () => {
    await asUser(A, 'insert into public.timesheet_reports(state) values ($1)', [
      JSON.stringify(report(null)),
    ]);
    await asUser(A, 'insert into public.timesheet_pop_settings(periods) values ($1)', ['[]']);
    await asUser(
      A,
      "insert into public.timesheet_logs(date, total_hours) values ('2035-02-05', 3.5)",
    );
    const before = await snapshot();
    await expect(
      asUser(A, 'select public.replace_timesheet_workspace($1, $2, $3)', [
        '[]',
        JSON.stringify(report(null)),
        '[]',
      ]),
    ).rejects.toThrow('Set a valid PTO accrual rate');
    expect(await snapshot()).toEqual(before);
  });
});
