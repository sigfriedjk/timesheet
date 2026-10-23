import { expect, test, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { POP_PERIODS } from '../../src/config/periodsOfPerformance';
import { MonthlyReportState } from '../../src/types';

const HOST = 'https://yiqquogdutgujsacoezh.supabase.co';
const A = '11111111-1111-4111-8111-111111111111';
const report: MonthlyReportState = { ptoPolicyVersion: 1, settings: { openingMonth: '2026-01', openingPto: 0, openingHoliday: 0, openingBirthday: 0, workPercent: 100 }, entries: [], projectedWork: {} };
const entry = (date = '2026-10-01', hours = 8, notes = 'cloud entry') => ({ user_id: A, id: date, date, total_hours: hours, notes, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' });
async function backend(page: Page, signedIn = true) {
  const state = { logs: [entry()], report, periods: POP_PERIODS.map(period => ({ ...period })), failRead: false, failWrite: false, delay: 0, requests: [] as { path: string; method: string; body: any }[] };
  await page.route(`${HOST}/**`, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const body = request.postDataJSON(); const method = request.method();
    state.requests.push({ path, method, body });
    if (state.delay && method === 'POST') await new Promise(resolve => setTimeout(resolve, state.delay));
    let data: unknown; let status = 200;
    if (path.includes('/auth/')) data = {};
    else if ((method === 'GET' && state.failRead) || (method !== 'GET' && state.failWrite)) { data = { message: 'Simulated connection failure', code: 'TEST' }; status = 500; }
    else if (path.endsWith('/rpc/replace_timesheet_workspace')) {
      state.logs = body.p_logs.map((log: any) => entry(log.date, log.total_hours, log.notes));
      state.report = body.p_report; state.periods = body.p_periods;
      data = state.logs.length;
    }
    else if (path.endsWith('/timesheet_pop_settings')) {
      if (method === 'POST') state.periods = body.periods;
      data = { periods: state.periods };
    }
    else if (path.endsWith('/timesheet_reports')) {
      if (method === 'POST') state.report = body.state;
      data = { state: state.report };
    } else if (path.endsWith('/timesheet_logs')) {
      if (method === 'POST' && Array.isArray(body)) {
        const added = body.filter(log => !state.logs.some(existing => existing.date === log.date)).map(log => entry(log.date, log.total_hours, log.notes));
        state.logs.push(...added); data = added;
      }
      else if (method === 'POST') { const log = entry(body.date, body.total_hours, body.notes); state.logs = [log, ...state.logs.filter(item => item.date !== body.date)]; data = log; }
      else if (method === 'DELETE') { const date = new URL(request.url()).searchParams.get('date')!.slice(3); state.logs = state.logs.filter(item => item.date !== date); data = [{ date }]; }
      else data = state.logs;
    } else throw new Error(`Unexpected Supabase endpoint: ${path}`);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  if (signedIn) await page.addInitScript(({ A }) => {
    // Clock-controlled report tests advance across days; keep their mock session valid.
    const expiresAt = Date.parse('2030-01-01T00:00:00Z') / 1000;
    const token = `header.${btoa(JSON.stringify({ sub: A, exp: expiresAt, role: 'authenticated' }))}.test`;
    localStorage.setItem('sb-yiqquogdutgujsacoezh-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user: { id: A, email: 'test@example.invalid', aud: 'authenticated' } }));
  }, { A });
  return state;
}
const nav = (page: Page, name: string) => page.locator('.nav-tab-btn').filter({ hasText: name }).click();
const openLeave = async (page: Page) => {
  if (await page.locator('.leave-settings').getAttribute('open') === null) await page.locator('.leave-settings > summary').click();
};
test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-10-22T12:00:00') }); });

test('signed-out Settings leads with the source and gates workspace controls', async ({ page }) => {
  await backend(page, false);
  await page.goto('/?view=settings');
  await expect(page.locator('.settings-view > section').first()).toHaveClass(/data-source-settings/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.locator('.settings-unavailable')).toContainText('Sign in and load My data');
  await expect(page.locator('.data-transfer-settings, .pop-settings, .leave-policy, .sample-settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import existing browser data' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export browser data JSON' })).toHaveCount(0);
  await expect(page.locator('.project-settings details')).not.toHaveAttribute('open', '');
  await page.getByText('Advanced project setup', { exact: true }).click();
  await expect(page.getByLabel('Project URL', { exact: true })).toBeVisible();
});

test('exports all saved inputs and requires confirmation before replacing every section; failed restores can retry', async ({ page }) => {
  test.slow(); // Includes an intentional SDK write failure and retry, plus backup round-trip checks.
  const state = await backend(page);
  state.logs.push(entry('2026-10-02', 7, 'removed by replacement'));
  await page.goto('/?view=settings');
  const card = page.locator('.data-transfer-settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.logs).toHaveLength(2);
  expect(backup.logs[0].totalHours).toBe(8);
  expect(backup.report).toEqual(report);
  expect(backup.periods).toEqual(POP_PERIODS);
  expect(backup.version).toBe(2);
  expect(JSON.stringify(backup)).not.toMatch(/birthdayMonth|monthlyBalances/);
  expect(JSON.stringify(backup)).not.toMatch(/access_token|refresh_token|user_id/);
  await page.locator('.restore-settings:not([open]) > summary').click();
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('[{"date":"2026-02-30","totalHours":8}]') });
  await expect(card.getByRole('alert')).toContainText('Invalid date');
  expect(state.requests.filter(request => request.path.includes('/rpc/'))).toHaveLength(0);
  const restoredReport = { ...report, settings: { ...report.settings, openingPto: 123, openingHoliday: 45, openingBirthday: 6, workPercent: 90 },
    entries: ['pto', 'holiday', 'birthday', 'overhead', 'adjustment'].map((category, i) => ({ id: category, date: '2026-10-05', category, hours: i === 4 ? -1.25 : i + 1, notes: `Restore ${category}` })), projectedWork: { '2026-11': 120 } };
  const restoredPeriods = [{ ...POP_PERIODS[0], name: 'Restored POP', startDate: '2026-01-01', endDate: '2026-12-31', targetHours: 1800 }];
  const replacement = { format: 'timesheet', version: 2, dataset: 'personal', logs: [{ date: '2026-10-01', totalHours: 1 }, { date: '2026-10-22', totalHours: 4.1 }], report: restoredReport, periods: restoredPeriods };
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...replacement, dataset: 'sample2026' })) });
  await expect(card.getByRole('alert')).toContainText('Choose a My data backup');
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await expect(card.locator('.json-import-preview')).toContainText('2 time entries; 5 leave/adjustment entries; 1 POPs');
  await expect(page.getByRole('button', { name: 'Restore backup', exact: true })).toBeDisabled();
  await page.getByLabel('Replace all data in My data with this file.').check();
  state.failWrite = true;
  await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Simulated connection failure');
  await expect(card.locator('.json-import-preview')).toBeVisible();
  state.failWrite = false;
  await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('Replaced this workspace with 2 time entries');
  expect(state.logs.find(log => log.date === '2026-10-01')!.total_hours).toBe(1);
  expect(state.logs.some(log => log.date === '2026-10-02')).toBe(false);
  expect(state.report).toEqual(restoredReport);
  expect(state.periods).toEqual(restoredPeriods);
  await page.reload();
  await expect(page.locator('input[name=openingPto]')).toHaveValue('123');
  await expect(page.locator('.pop-settings-table tbody tr')).toHaveCount(1);
  await expect(page.getByLabel('Birthday credit month')).toHaveCount(0);
  await nav(page, 'Calendar');
  await expect(page.locator('.calendar-logged')).toHaveCount(2);
});

test('sample Settings hides data transfer and connection controls and saves locally offline', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?sample=2026&view=settings');
  await expect(page.locator('.settings-view > section').first()).toHaveClass(/data-source-settings/);
  await expect(page.locator('.data-source-settings')).toContainText('this browser’s sample workspace');
  await expect(page.locator('.data-transfer-settings, .supabase-settings, .project-settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Import|Export|Download/ })).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.context().setOffline(true);
  await openLeave(page);
  await page.locator('input[name=openingPto]').fill('42.25');
  await page.getByRole('button', { name: 'Save leave settings' }).click();
  await expect(page.locator('.leave-policy [role=status]')).toContainText('saved to this browser’s sample workspace');
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.locator('input[name=openingPto]')).toHaveValue('42.25');
  await page.locator('.pop-management > summary').click();
  await page.getByRole('button', { name: 'Edit POP Q', exact: true }).click();
  await page.getByLabel('POP name', { exact: true }).fill('Discard on reset');
  await page.getByRole('button', { name: 'Reset sample data' }).click();
  await expect(page.locator('input[name=openingPto]')).toHaveValue('0');
  await expect(page.locator('.pop-editor')).toHaveCount(0);
  expect(state.report.settings.openingPto).toBe(0);
  expect(state.requests).toHaveLength(0);
});

test('POP names, dates and funding persist, update summaries, and stay isolated from sample data', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?view=settings');
  await page.locator('.pop-management > summary').click();
  await page.getByRole('button', { name: 'Edit POP Q', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Edit POP' });
  await editor.getByLabel('POP name').fill('Custom Q');
  await editor.getByLabel('End date').fill('2026-11-30');
  await editor.getByLabel('Funded hours').fill('800');
  state.failWrite = true;
  await page.getByRole('button', { name: 'Save POP', exact: true }).click();
  await expect(page.locator('.pop-settings').getByRole('alert')).toContainText('Simulated connection failure');
  await expect(editor.getByLabel('POP name')).toHaveValue('Custom Q');
  state.failWrite = false;
  await page.getByRole('button', { name: 'Save POP', exact: true }).click();
  await expect(page.locator('.pop-settings').getByRole('status')).toContainText('POP definitions saved');
  await page.reload();
  await page.locator('.pop-management > summary').click();
  await expect(page.getByRole('button', { name: 'Edit Custom Q', exact: true })).toBeVisible();
  await nav(page, 'POP');
  await expect(page.locator('[data-pop=pop-q]')).toContainText('Custom Q');
  await expect(page.locator('[data-pop=pop-q]')).toContainText('800');
  await nav(page, 'Settings');
  await page.locator('input[value=sample2026]').check();
  await page.locator('.pop-management > summary').click();
  await expect(page.getByRole('button', { name: 'Edit POP Q', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Custom Q', exact: true })).toHaveCount(0);
});

test('fresh personal visits require sign-in and never use legacy browser records automatically', async ({ page }) => {
  const state = await backend(page, false);
  await page.addInitScript(() => localStorage.setItem('work_hours_tracker_time_logs', JSON.stringify([{ date: '2026-10-21', totalHours: 12 }])));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to your timesheet' })).toBeVisible();
  await expect(page.locator('.calculator-view')).toHaveCount(0);
  expect(state.requests.filter(item => item.path.includes('/rest/'))).toHaveLength(0);
});

test('sample calculator, calendar, monthly, POP and settings work offline without any Supabase requests', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?sample=2026');
  await expect(page.locator('.calendar-logged')).toHaveCount(149);
  await nav(page, 'Monthly');
  await expect(page.locator('[data-stat=month-work-hours]')).toHaveText('97.8 h');
  await nav(page, 'POP');
  await expect(page.locator('.pop-table tfoot td').nth(5)).toHaveText('1210.7');
  await nav(page, 'Calculator');
  await page.locator('#log-date').fill('2026-10-21');
  await page.getByLabel('Time out', { exact: true }).fill('17:00');
  await page.getByRole('button', { name: /Log Time to Database/ }).click();
  await expect(page.locator('.calendar-logged')).toHaveCount(150);
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Reset sample data' }).click();
  await expect(page.getByText('Sample data reset to the original 149 entries.')).toBeVisible();
  await page.context().setOffline(true);
  await nav(page, 'Monthly');
  await expect(page.locator('[data-stat=month-work-hours]')).toHaveText('97.8 h');
  expect(state.requests).toHaveLength(0);
});

test('recovers auth, loads cloud records, preserves failed calculator draft and navigates only after save', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/');
  await expect(page.locator('.calculator-view')).toBeVisible();
  await page.locator('#log-date').fill('2026-10-21');
  await page.getByLabel('Time out', { exact: true }).fill('17:00');
  await page.locator('#log-notes').fill('keep this draft');
  state.failWrite = true;
  await page.getByRole('button', { name: /Log Time to Database/ }).click();
  await expect(page.getByRole('alert')).toContainText('Simulated connection failure');
  await expect(page.locator('#log-notes')).toHaveValue('keep this draft');
  await expect(page.locator('.year-calendar')).toHaveCount(0);
  state.failWrite = false; state.delay = 300;
  await page.getByRole('button', { name: /Log Time to Database/ }).click();
  await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled();
  await expect(page.locator('.calendar-logged')).toHaveCount(2);
  expect(state.logs.find(item => item.date === '2026-10-21')?.total_hours).toBe(9);
});

for (const width of [390, 1280]) test(`calculator aligns labels and normalizes required shift times at ${width}px`, async ({ page }) => {
  const state = await backend(page);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/?view=calculator');
  const shift = page.getByRole('region', { name: 'Entry Creator', exact: true });
  const target = page.getByRole('region', { name: 'Out Target' });
  await expect(shift.getByLabel('Custom break minutes', { exact: true })).toHaveValue('0');
  await expect(shift.getByLabel('Time out', { exact: true })).toHaveAttribute('required', '');
  await expect(shift).not.toContainText(/Time Out \(Optional\)|Leave blank to log through/);
  await shift.getByRole('button', { name: /Log Time to Database/ }).click();
  expect(state.requests.filter(request => request.path.endsWith('/timesheet_logs') && request.method === 'POST')).toHaveLength(0);
  await expect(shift.getByLabel('Time out', { exact: true })).toHaveValue('');
  await expect(target.getByRole('button', { name: /Now|Clear/ })).toHaveCount(0);
  const copy = target.getByRole('button', { name: 'Use as Time Out', exact: true });
  await expect(copy).toBeEnabled();
  await expect(target.getByLabel('Target out time', { exact: true })).not.toBeEditable();
  await expect(page.getByRole('region', { name: 'Shift Target', exact: true })).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(shift.locator('.break-presets > :first-child')).toHaveAttribute('id', 'break-mins');
  const start = shift.getByLabel('Time in', { exact: true });
  await start.fill('1025');
  await start.blur();
  await expect(start).toHaveValue('10:25');
  const out = shift.getByLabel('Time out', { exact: true });
  await copy.click();
  await expect(out).toHaveValue('18:55');
  await out.fill('1100');
  await out.blur();
  await expect(out).toHaveValue('11:00');
  const desired = target.getByLabel('Target out time', { exact: true });
  await target.getByRole('button', { name: 'Edit time out and calculate hours', exact: true }).click();
  await expect(desired).toBeEditable();
  await expect(target.getByLabel('Target hours', { exact: true })).not.toBeEditable();
  await desired.fill('2460');
  await desired.blur();
  await expect(desired).toHaveValue('2460');
  await expect(desired).toHaveAttribute('aria-invalid', 'true');
  await expect(copy).toBeDisabled();
  await desired.fill('1830');
  await desired.blur();
  await expect(desired).toHaveValue('18:30');
  await copy.click();
  await expect(out).toHaveValue('18:30');
  await expect(shift.getByRole('button', { name: /Log Time to Database/ })).toContainText('8.1 hrs');
  for (const id of ['log-date', 'time-in', 'time-out', 'break-mins', 'log-notes']) {
    const label = await shift.locator(`label[for="${id}"]`).boundingBox();
    const input = await shift.locator(`#${id}`).boundingBox();
    expect(label!.x + label!.width).toBeLessThanOrEqual(input!.x);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/calculator-${width}.png`, fullPage: true });
  await shift.getByRole('button', { name: /Log Time to Database/ }).click();
  await expect(page.locator('.calendar-logged')).toHaveCount(2);
  expect(state.logs.find(log => log.date === '2026-10-22')?.total_hours).toBe(8.1);
});

test('day editor stays open on failure and closes after an acknowledged save; delete updates cloud', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?view=calendar');
  await page.getByRole('button', { name: 'Edit 2026-10-01', exact: true }).click();
  await page.locator('#day-hours').fill('9.2');
  await page.locator('#day-notes').fill('day draft');
  state.failWrite = true;
  await page.getByRole('button', { name: 'Save hours', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#day-notes')).toHaveValue('day draft');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Simulated');
  state.failWrite = false;
  await page.getByRole('button', { name: 'Save hours', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete 2026-10-01', exact: true }).click();
  await expect(page.locator('.calendar-logged')).toHaveCount(0);
});

test('Out Target switches its editable field, recalculates with breaks, and copies either direction', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=calculator');
  const today = page.getByRole('region', { name: 'Entry Creator', exact: true });
  const target = page.getByRole('region', { name: 'Out Target', exact: true });
  const hours = target.getByLabel('Target hours', { exact: true });
  const time = target.getByLabel('Target out time', { exact: true });
  const actualOut = today.getByLabel('Time out', { exact: true });
  await today.getByLabel('Time in', { exact: true }).fill('22:00');
  await hours.fill('8');
  await expect(time).toHaveValue('06:00');
  await target.getByRole('button', { name: 'Use as Time Out', exact: true }).click();
  await expect(actualOut).toHaveValue('06:00');
  const clear = today.getByRole('button', { name: 'Clear', exact: true });
  const now = actualOut.locator('..').getByRole('button', { name: 'Now', exact: true });
  expect(await clear.evaluate(el => getComputedStyle(el).color)).toBe(await now.evaluate(el => getComputedStyle(el).color));
  await clear.click();
  await expect(actualOut).toHaveValue('');
  await target.getByRole('button', { name: 'Edit time out and calculate hours', exact: true }).click();
  await time.fill('0630');
  await time.blur();
  await expect(time).toHaveValue('06:30');
  await expect(hours).toHaveValue('8.5');
  await today.getByLabel('Custom break minutes', { exact: true }).fill('30');
  await expect(hours).toHaveValue('8');
  await target.getByRole('button', { name: 'Use as Time Out', exact: true }).click();
  await expect(actualOut).toHaveValue('06:30');
  await target.getByRole('button', { name: 'Edit hours and calculate time out', exact: true }).click();
  await expect(hours).toBeEditable();
  await expect(time).not.toBeEditable();
  await expect(time).toHaveValue('06:30');
  await hours.fill('9');
  await expect(time).toHaveValue('07:30');
  await target.getByRole('button', { name: 'Use as Time Out', exact: true }).click();
  await expect(actualOut).toHaveValue('07:30');
  await hours.fill('');
  await expect(time).toHaveValue('');
  await expect(target.getByRole('button', { name: 'Use as Time Out', exact: true })).toBeDisabled();
});

test('Calendar and POP numbers omit trailing decimal zeros in totals, cells, and the day editor', async ({ page }) => {
  const state = await backend(page);
  state.logs = [entry('2026-10-01', 8), entry('2026-10-02', 8.1), entry('2026-10-03', 0)];
  state.periods = [{ ...POP_PERIODS[0], id: 'formatting', name: 'Formatting', startDate: '2026-01-01', endDate: '2026-12-31', targetHours: 100.1 }];
  await page.goto('/?view=calendar');
  await expect(page.locator('.calendar-day[aria-label^="October 1, 2026:"] .calendar-hours')).toHaveText('8');
  await expect(page.locator('.calendar-day[aria-label^="October 2, 2026:"] .calendar-hours')).toHaveText('8.1');
  await expect(page.locator('.calendar-day[aria-label^="October 3, 2026:"] .calendar-hours')).toHaveText('0');
  const numbers = await page.locator('.kpi-value, .month-heading > span, .calendar-hours, .hours-badge').allTextContents();
  expect(numbers.some(text => /\.\d*0(?:\s|$)/.test(text))).toBe(false);
  await page.getByRole('button', { name: 'Edit 2026-10-01', exact: true }).click();
  await expect(page.getByLabel('Total hours', { exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Close day editor', exact: true }).click();
  await nav(page, 'POP');
  await expect(page.locator('.pop-table tfoot td').nth(5)).toHaveText('16.1');
  await expect(page.locator('.pop-table tfoot td').nth(6)).toHaveText('84');
  expect((await page.locator('.pop-table td, .pop-stats strong').allTextContents()).some(text => /\.\d*0(?:\s|%|$)/.test(text))).toBe(false);
  await nav(page, 'Settings');
  await expect(page.locator('footer')).toHaveCount(0);
});

for (const width of [390, 1280]) test(`summaries default to All Years and show every row with page scrolling at ${width}px`, async ({ page }) => {
  const state = await backend(page);
  state.logs = [entry('2025-01-02', 8), entry('2026-01-02', 9), entry('2027-09-01', 10)];
  state.report = { ...report, settings: { ...report.settings, openingMonth: '2024-11' },
    entries: [{ id: 'january-2026', date: '2026-01-03', category: 'pto', hours: 3 }], projectedWork: { '2028-03': 100 } };
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/?view=monthly');
  const year = page.getByLabel('Monthly summary year', { exact: true });
  await expect(year).toHaveValue('all');
  await expect(page.locator('.monthly-table tbody tr')).toHaveCount(50);
  await expect(page.locator('[data-month="2025-01"] th')).toContainText('Jan 2025');
  await expect(page.locator('[data-month="2026-01"] th')).toContainText('Jan 2026');
  await expect(page.locator('.monthly-table tfoot td').nth(2)).toHaveText('17');
  const current = page.locator('[data-month="2026-10"]');
  const future = page.locator('[data-month="2027-01"]');
  const previous = page.locator('[data-month="2025-10"]');
  await expect(current).toHaveAttribute('aria-current', 'date');
  await expect(current.locator('th')).toContainText('Current month');
  await expect(future.locator('th')).toContainText('Forecast');
  const currentColor = await current.locator('td').first().evaluate(el => getComputedStyle(el).backgroundColor);
  const futureColor = await future.locator('td').first().evaluate(el => getComputedStyle(el).backgroundColor);
  const previousColor = await previous.locator('td').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(new Set([currentColor, futureColor, previousColor]).size).toBe(3);
  const wrapper = page.locator('.monthly-table-scroll');
  expect(await wrapper.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.locator('[data-month="2028-12"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await wrapper.evaluate(el => el.scrollTop)).toBe(0);
  await year.selectOption('2025');
  await expect(page.locator('.monthly-table tbody tr')).toHaveCount(12);
  await expect(page.locator('[data-month="2026-01"]')).toHaveCount(0);
  await expect(page.locator('.current-month-row')).toHaveCount(0);
  await expect(page.locator('.monthly-table tfoot td').nth(2)).toHaveText('8');
  await page.getByRole('button', { name: 'Edit January 2025 leave', exact: true }).click();
  const editor = page.getByRole('form', { name: 'January 2025' });
  await editor.getByLabel('PTO entered', { exact: true }).fill('2');
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.report.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ date: '2025-01-31', category: 'pto', hours: 2 }),
    { id: 'january-2026', date: '2026-01-03', category: 'pto', hours: 3 },
  ]));
  await year.selectOption('all');
  await expect(page.locator('[data-month="2025-01"] .used-pto')).toHaveText('2');
  await expect(page.locator('[data-month="2026-01"] .used-pto')).toHaveText('3');
  await nav(page, 'POP');
  await expect(page.getByLabel('POP year', { exact: true })).toHaveCount(0);
  await expect(page.locator('.pop-table tbody tr')).toHaveCount(24);
  expect(await page.locator('.pop-table-scroll').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.locator('.pop-table tbody tr').last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await page.locator('.pop-table-scroll').evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator('.pop-table tbody tr')).toHaveCount(24);
});

test('monthly summary trims zeros, collapses accruals, and edits the five saved totals', async ({ page }) => {
  const state = await backend(page);
  state.report = { ...report, entries: [
    { id: 'pto', date: '2026-10-01', category: 'pto', hours: 8, notes: 'Existing date and note' },
    { id: 'holiday', date: '2026-10-12', category: 'holiday', hours: 8.1 },
    { id: 'birthday', date: '2026-10-01', category: 'birthday', hours: 8.11 },
    { id: 'other-month', date: '2026-09-01', category: 'pto', hours: 4 },
  ], projectedWork: { '2026-11': 123.4 } };
  await page.clock.setFixedTime(new Date('2026-10-31T12:00:00'));
  await page.goto('/?view=monthly');
  const table = page.locator('.monthly-table');
  await expect(table.getByRole('columnheader', { name: '12m avg', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-stat=rolling-average]')).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Total', exact: true })).toHaveCount(0);
  await expect(table.locator('tbody tr').first().locator('td')).toHaveCount(14);
  await expect(page.getByRole('button', { name: 'Show accrued', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Show accrued', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: 'Accrued', exact: true })).toBeVisible();
  await expect(table.locator('tbody tr').first().locator('td')).toHaveCount(17);
  await page.getByRole('button', { name: 'Hide accrued', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: 'Accrued', exact: true })).toHaveCount(0);
  expect(await table.locator('tbody td, tfoot td').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.\d*0$/)]));
  const october = page.locator('[data-month="2026-10"]');
  await expect(october.locator('td').nth(6)).toHaveText('8');
  await expect(october.locator('td').nth(7)).toHaveText('8.1');
  await expect(october.locator('td').nth(8)).toHaveText('8.11');
  await page.getByRole('button', { name: 'Edit October 2026 leave', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const editor = page.getByRole('form', { name: 'October 2026' });
  await expect(editor.locator('input')).toHaveCount(5);
  await expect(editor.getByLabel('PTO entered', { exact: true })).toHaveValue('8');
  await expect(editor.getByLabel('Holiday entered', { exact: true })).toHaveValue('8.1');
  await expect(editor.getByLabel('Birthday entered', { exact: true })).toHaveValue('8.11');
  await editor.getByLabel('Overhead entered', { exact: true }).fill('2');
  await editor.getByLabel('PTO adjustment', { exact: true }).fill('-1.25');
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.report.entries).toEqual(expect.arrayContaining([
    { id: 'pto', date: '2026-10-01', category: 'pto', hours: 8, notes: 'Existing date and note' },
    { id: 'other-month', date: '2026-09-01', category: 'pto', hours: 4 },
    expect.objectContaining({ category: 'overhead', hours: 2 }),
    expect.objectContaining({ category: 'adjustment', hours: -1.25 }),
  ]));
  expect(state.report.projectedWork).toEqual({ '2026-11': 123.4 });
  await page.reload();
  await page.getByRole('button', { name: 'Edit October 2026 leave', exact: true }).click();
  await expect(editor.getByLabel('PTO adjustment', { exact: true })).toHaveValue('-1.25');
  await editor.getByLabel('PTO entered', { exact: true }).fill('99');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit October 2026 leave', exact: true }).click();
  await expect(editor.getByLabel('PTO entered', { exact: true })).toHaveValue('8');
});

test('summary cards use today automatically, refresh at midnight, and keep forecasts separate', async ({ page }) => {
  const state = await backend(page);
  state.logs = [entry('2026-10-21', 7), entry('2026-10-22', 8), entry('2026-10-23', 9)];
  state.report = { ...report, settings: { ...report.settings, openingMonth: '2026-10', openingPto: 10, openingHoliday: 20, openingBirthday: 30 }, entries: [
    { id: 'pto', date: '2026-10-22', category: 'pto', hours: 2 },
    { id: 'holiday', date: '2026-10-22', category: 'holiday', hours: 3 },
    { id: 'birthday', date: '2026-10-22', category: 'birthday', hours: 4 },
    { id: 'adjustment', date: '2026-10-22', category: 'adjustment', hours: 1 },
    { id: 'future', date: '2026-10-23', category: 'pto', hours: 6 },
  ] };
  await page.clock.pauseAt(new Date('2026-10-22T23:59:59'));
  await page.goto('/?view=monthly');
  await expect(page.locator('[data-stat=month-work-hours]')).toHaveText('24 h');
  await expect(page.getByRole('region', { name: 'Current month', exact: true })).not.toContainText('Logged');
  await expect(page.locator('.monthly-stats .summary-stat')).toHaveCount(2);
  await expect(page.locator('[data-stat=month-work-hours]')).toBeVisible();
  const forecast = parseFloat((await page.locator('[data-stat=month-work-hours]').textContent())!);
  expect(forecast).toBe(24);
  await expect(page.getByRole('region', { name: 'End-of-month balance', exact: true })).toContainText('September 2026');
  await expect(page.getByText('Set an opening month and balances in Settings.')).toBeVisible();
  await expect(page.locator('[data-stat=current-leave], [data-stat=year-end-leave]')).toHaveCount(0);
  await expect(page.locator('.monthly-view')).not.toContainText(/Leave through|Actuals through|December leave/);
  await expect(page.locator('.monthly-view input[type=date]')).toHaveCount(0);
  await expect(page.locator('main').getByRole('button', { name: /settings/i })).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.locator('[data-stat=month-work-hours]')).toHaveText('24 h');
  await nav(page, 'POP');
  await expect(page.locator('.pop-table tfoot td').nth(5)).toHaveText('24');
  await expect(page.locator('.pop-view input[type=date]')).toHaveCount(0);
  await expect(page.locator('main').getByRole('button', { name: /settings/i })).toHaveCount(0);
  await nav(page, 'Calculator');
  await expect(page.locator('main').getByRole('button', { name: /settings/i })).toHaveCount(0);
});

test('monthly editor distinguishes absent values from entered zero without inventing historical leave', async ({ page }) => {
  const state = await backend(page);
  state.report = { ...report, settings: { ...report.settings, ...{ autoPto: true } } };
  await page.goto('/?view=monthly');
  const february = page.locator('[data-month="2026-02"] .used-pto');
  await expect(february).toHaveText('0');
  await page.getByRole('button', { name: 'Edit February 2026 leave', exact: true }).click();
  const editor = page.getByRole('form', { name: 'February 2026' });
  await expect(editor.getByLabel('PTO entered', { exact: true })).toHaveValue('');
  await editor.getByLabel('PTO entered', { exact: true }).fill('0');
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(february).toHaveText('0');
  expect(state.report.entries).toEqual([expect.objectContaining({ category: 'pto', hours: 0 })]);
  await page.getByRole('button', { name: 'Edit February 2026 leave', exact: true }).click();
  await editor.getByLabel('PTO entered', { exact: true }).fill('');
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(february).toHaveText('0');
  expect(state.report.entries).toHaveLength(0);
  await nav(page, 'Settings');
  await expect(page.getByLabel('Auto-fill historical PTO gaps')).toHaveCount(0);
  await expect(page.locator('.leave-policy')).not.toContainText('unlogged weekday hours');
});

test('report and leave settings preserve drafts on failure and persist on retry', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?view=monthly');
  await page.getByRole('button', { name: 'Edit October 2026 leave', exact: true }).click();
  const editor = page.getByRole('form', { name: 'October 2026' });
  await editor.getByLabel('PTO entered', { exact: true }).fill('8.11');
  state.failWrite = true;
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Simulated');
  await expect(editor.getByLabel('PTO entered', { exact: true })).toHaveValue('8.11');
  expect(state.report.entries).toHaveLength(0);
  state.failWrite = false;
  await editor.getByRole('button', { name: 'Save month', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.report.entries).toEqual([expect.objectContaining({ date: '2026-10-22', category: 'pto', hours: 8.11 })]);
  await nav(page, 'Settings');
  await openLeave(page);
  await page.locator('input[name=openingPto]').fill('75.25');
  state.failWrite = true;
  await page.getByRole('button', { name: 'Save leave settings' }).click();
  await expect(page.locator('.leave-policy [role=alert]')).toContainText('Simulated');
  await expect(page.locator('input[name=openingPto]')).toHaveValue('75.25');
  state.failWrite = false;
  await page.getByRole('button', { name: 'Save leave settings' }).click();
  await expect(page.locator('.leave-policy [role=status]')).toContainText('saved');
  expect(state.report.settings.openingPto).toBe(75.25);
});

test('load failures gate every personal view, allow retry, and sign-out removes cloud records', async ({ page }) => {
  const state = await backend(page); state.failRead = true;
  await page.goto('/?view=calendar');
  await expect(page.getByRole('button', { name: 'Retry loading data' })).toBeVisible();
  await expect(page.locator('.year-calendar')).toHaveCount(0);
  state.failRead = false;
  await page.getByRole('button', { name: 'Retry loading data' }).click();
  await expect(page.locator('.calendar-logged')).toHaveCount(1);
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('#supabase-email')).toBeVisible();
  await nav(page, 'Calendar');
  await expect(page.getByRole('heading', { name: 'Sign in to your timesheet' })).toBeVisible();
  await expect(page.locator('.calendar-logged')).toHaveCount(0);
});

for (const width of [390, 1280]) test(`access and sample settings fit viewport ${width}`, async ({ page }) => {
  await backend(page, false);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expect(page.locator('.supabase-access')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/access-${width}.png`, fullPage: true });
  await page.goto('/?sample=2026&view=settings');
  await expect(page.locator('.leave-policy')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/settings-${width}.png`, fullPage: true });
});


test('break presets set minutes without selected toggle styling', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=calculator');
  const input = page.getByLabel('Custom break minutes', { exact: true });
  for (const minutes of [30, 60, 0, 30]) {
    const button = page.getByRole('button', { name: `${minutes} min`, exact: true });
    await button.click();
    await expect(input).toHaveValue(String(minutes));
    await expect(button).not.toHaveClass(/chip-active/);
    await expect(button).not.toHaveAttribute('aria-pressed');
  }
});


test('break minutes round up to six-minute increments on blur', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=calculator');
  const input = page.getByLabel('Custom break minutes', { exact: true });
  for (const [typed, rounded] of [['7', '12'], ['6', '6'], ['6.1', '12'], ['0', '0'], ['479', '480']]) {
    await input.fill(typed);
    await input.blur();
    await expect(input).toHaveValue(rounded);
  }
});


test('calendar highlights the actual current day even when it has logged hours', async ({ page }) => {
  const state = await backend(page);
  state.logs.push(entry('2026-10-22', 8));
  await page.goto('/?view=calendar');
  const today = page.locator('.calendar-day[aria-current="date"]');
  await expect(today).toHaveClass(/calendar-today/);
  await expect(today).toHaveClass(/calendar-logged/);
  await expect(today).toHaveAttribute('aria-label', /^October 22, 2026:/);
  await page.getByRole('button', { name: 'Previous year', exact: true }).click();
  await expect(page.locator('.calendar-today')).toHaveCount(0);
});


test('jump to today selects this year and scrolls to the current calendar month', async ({ page }) => {
  await backend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=calendar');
  await page.getByRole('button', { name: 'Previous year', exact: true }).click();
  await page.getByRole('button', { name: 'Jump to today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'October 2026', exact: true })).toBeInViewport();
  await expect(page.locator('.calendar-today')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test('saved entries can be filtered by month and year', async ({ page }) => {
  const state = await backend(page);
  state.logs.push(entry('2026-01-05', 7), entry('2025-01-05', 6));
  await page.goto('/?view=calendar');
  const rows = page.locator('.logs-table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('2026-10-01');
  await page.getByLabel('Saved entries month', { exact: true }).selectOption('01');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('2026-01-05');
  await page.getByLabel('Saved entries year', { exact: true }).selectOption('2025');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('2025-01-05');
  await page.getByLabel('Saved entries month', { exact: true }).selectOption('02');
  await expect(page.getByText('No entries recorded for February 2025.')).toBeVisible();
});


test('monthly cards stay tied to today while the table year changes', async ({ page }) => {
  const state = await backend(page);
  state.report = { ...report, settings: { ...report.settings, openingMonth: '2025-12', openingPto: 100 }, entries: [] };
  state.logs.push(entry('2025-12-02', 8));
  await page.goto('/?view=monthly');
  const cards = page.locator('.monthly-stats');
  await expect(cards.locator('.summary-stat')).toHaveCount(2);
  await expect(cards).toContainText('September 2026');
  await expect(cards).toContainText('October 2026');
  const before = await cards.textContent();
  const select = page.getByLabel('Monthly summary year', { exact: true });
  await expect(page.locator('thead .month-column').getByRole('combobox')).toHaveCount(1);
  await select.selectOption('2025');
  await expect(page.locator('[data-month="2026-10"]')).toHaveCount(0);
  await expect(cards).toHaveText(before!);
  await expect(page.getByText('Calculation details', { exact: true })).toHaveCount(0);
});


test('POP rows highlight active inclusive boundaries and upcoming periods', async ({ page }) => {
  const state = await backend(page);
  state.periods = [
    { id: 'past', name: 'Past', startDate: '2026-09-01', endDate: '2026-10-21', targetHours: 100 },
    { id: 'current', name: 'Current', startDate: '2026-10-22', endDate: '2026-10-23', targetHours: 16 },
    { id: 'next', name: 'Next', startDate: '2026-10-24', endDate: '2026-11-30', targetHours: 100 },
  ];
  await page.goto('/?view=pop');
  await expect(page.getByText('Calculation details', { exact: true })).toHaveCount(0);
  const current = page.locator('[data-pop=current]');
  await expect(current).toHaveAttribute('aria-current', 'date');
  await expect(current).toHaveClass(/current-month-row/);
  await expect(page.locator('[data-pop=next]')).toHaveClass(/future-month-row/);
  await expect(page.locator('[data-pop=past]')).not.toHaveClass(/current-month-row|future-month-row/);
  await page.clock.setFixedTime(new Date('2026-10-23T12:00:00'));
  await page.reload();
  await expect(current).toHaveClass(/current-month-row/);
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00'));
  await page.reload();
  await expect(current).not.toHaveClass(/current-month-row/);
  await expect(page.locator('[data-pop=next]')).toHaveAttribute('aria-current', 'date');
});


test('legacy personal browser records are not offered for import or read into the cloud workspace', async ({ page }) => {
  const state = await backend(page);
  const legacy = JSON.stringify([{ id: 'legacy', date: '2025-01-01', totalHours: 9 }]);
  await page.addInitScript(value => localStorage.setItem('work_hours_tracker_time_logs', value), legacy);
  await page.goto('/?view=settings');
  await expect(page.getByRole('button', { name: 'Export backup', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Import existing browser data' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export browser data JSON' })).toHaveCount(0);
  expect(state.requests.some(request => request.path.includes('import_browser'))).toBe(false);
  expect(state.logs).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('work_hours_tracker_time_logs'))).toBe(legacy);
});

for (const width of [390, 1280]) test(`personal Settings explains scope and keeps advanced editors collapsed at ${width}px`, async ({ page }) => {
  await backend(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/?view=settings');
  await expect(page.locator('.source-context')).toContainText('Ready');
  await expect(page.locator('.source-context')).toContainText('test@example.invalid');
  await expect(page.locator('.source-context')).toContainText('yiqquogdutgujsacoezh.supabase.co');
  await expect(page.locator('.settings-view > section h3')).toHaveText(['Data source', 'Periods of performance', 'Leave & forecasts', 'Backup & restore', 'Advanced project setup']);
  for (const selector of ['.pop-management', '.leave-settings', '.restore-settings', '.supabase-setup']) {
    await expect(page.locator(selector)).not.toHaveAttribute('open', '');
  }
  await page.locator('.restore-settings > summary').click();
  await expect(page.locator('.restore-settings')).toContainText('Destination: test@example.invalid · yiqquogdutgujsacoezh.supabase.co');
  await page.locator('.pop-management > summary').click();
  await page.getByText('Advanced project setup', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/personal-settings-${width}.png`, fullPage: true });
});

test('loading and failed account data never expose default settings and retry recovers', async ({ page }) => {
  const state = await backend(page);
  state.failRead = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${HOST}/rest/**`, async route => { await gate; await route.fallback(); });
  await page.goto('/?view=settings');
  await expect(page.locator('.source-context')).toContainText('Loading your timesheet');
  await expect(page.locator('.leave-policy, .pop-settings, .data-transfer-settings')).toHaveCount(0);
  release();
  await expect(page.locator('.data-source-settings [role=alert]')).toContainText('Simulated connection failure');
  await expect(page.locator('.leave-policy, .pop-settings, .data-transfer-settings')).toHaveCount(0);
  state.failRead = false;
  await page.getByRole('button', { name: 'Retry loading data' }).click();
  await expect(page.locator('.source-context')).toContainText('Ready');
  await expect(page.locator('input[name=openingPto]')).toHaveValue('0');
});

test('source changes clear leave and POP drafts, restore files, and replacement confirmation', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=settings');
  await openLeave(page);
  await page.locator('input[name=openingPto]').fill('999');
  await page.locator('.pop-management > summary').click();
  await page.getByRole('button', { name: 'Edit POP Q', exact: true }).click();
  await page.getByLabel('POP name', { exact: true }).fill('Unsaved draft');
  await page.locator('.restore-settings > summary').click();
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from('[]') });
  await page.getByLabel('Replace all data in My data with this file.').check();
  await page.locator('input[value=sample2026]').check();
  await expect(page.locator('input[name=openingPto]')).toHaveValue('0');
  await expect(page.locator('.pop-editor, .data-transfer-settings')).toHaveCount(0);
  await page.locator('input[value=personal]').check();
  await expect(page.locator('input[name=openingPto]')).toHaveValue('0');
  await expect(page.locator('.pop-editor, .json-import-preview')).toHaveCount(0);
  await page.locator('.restore-settings > summary').click();
  await expect(page.getByLabel('Replace all data in My data with this file.')).not.toBeChecked();
  await expect(page.getByLabel('JSON file', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Restore backup', exact: true })).toBeDisabled();
});

test('sign-out and project changes remove account editors and pending restore state', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=settings');
  await page.locator('.restore-settings > summary').click();
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from('[]') });
  await page.getByLabel('Replace all data in My data with this file.').check();
  await page.getByText('Advanced project setup', { exact: true }).click();
  await page.getByLabel('Project URL', { exact: true }).fill('https://other-project.supabase.co');
  await page.getByRole('button', { name: 'Save project connection', exact: true }).click();
  await expect(page.locator('.source-context')).toContainText('other-project.supabase.co');
  await expect(page.locator('.data-transfer-settings, .leave-policy, .pop-settings')).toHaveCount(0);
  // Return to the original project, whose isolated session is still available.
  await page.getByText('Advanced project setup', { exact: true }).click();
  await page.getByLabel('Project URL', { exact: true }).fill(HOST);
  await page.getByRole('button', { name: 'Save project connection', exact: true }).click();
  await expect(page.locator('.source-context')).toContainText('Ready');
  await page.locator('.restore-settings > summary').click();
  await expect(page.getByLabel('JSON file', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Replace all data in My data with this file.')).not.toBeChecked();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('.data-transfer-settings, .leave-policy, .pop-settings')).toHaveCount(0);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

for (const width of [390, 1280]) test(`POP cards total the full July–June year and current period at ${width}px`, async ({ page }) => {
  const state = await backend(page);
  await page.clock.setFixedTime(new Date('2026-10-23T12:00:00'));
  state.periods = [
    { id: 'prior', name: 'Prior year', startDate: '2025-07-01', endDate: '2026-06-30', targetHours: 800 },
    { id: 'current', name: 'Current period', startDate: '2026-07-01', endDate: '2026-11-15', targetHours: 100 },
    { id: 'next', name: 'Next period', startDate: '2026-11-16', endDate: '2027-06-30', targetHours: 900 },
    { id: 'outside', name: 'Next year', startDate: '2027-07-01', endDate: '2028-06-30', targetHours: 800 },
  ];
  state.logs = [entry('2026-06-30', 5), entry('2026-07-01', 8), entry('2026-10-23', 7), entry('2026-11-02', 20), entry('2027-06-30', 8), entry('2027-07-01', 20)];
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/?view=pop');
  await expect(page.locator('.pop-stats .summary-stat')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'POP Year', exact: true })).toContainText('2026-07-01 – 2027-06-30');
  await expect(page.locator('[data-stat=pop-year-funded]')).toHaveText('1000 h');
  await expect(page.locator('[data-stat=pop-year-worked]')).toHaveText('43 h');
  await expect(page.locator('[data-stat=pop-year-available]')).toHaveText('957 h');
  await expect(page.locator('[data-stat=pop-current-worked]')).toHaveText('35 h');
  await expect(page.locator('[data-stat=pop-current-available]')).toHaveText('65 h');
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Available', exact: true })).toBeVisible();
  await page.locator('[data-pop=outside]').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Jump to today', exact: true }).click();
  await expect(page.locator('[data-pop=current]')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `work/pop-cards-${width}.png`, fullPage: true });
});

test('Monthly Summary uses entered forecasts and Jump to today restores the current year', async ({ page }) => {
  const state = await backend(page);
  state.logs = [entry('2025-01-02', 8), entry('2026-10-01', 7), entry('2026-10-30', 9), entry('2026-11-02', 6)];
  state.report = { ...report, settings: { ...report.settings, workPercent: 200 }, projectedWork: { '2026-10': 900 }, entries: [] };
  await page.goto('/?view=monthly');
  const current = page.getByRole('region', { name: 'Current month', exact: true });
  await expect(current).not.toContainText('Logged');
  await expect(page.locator('[data-stat=month-work-hours]')).toHaveText('16 h');
  await expect(page.locator('[data-month="2026-11"]').locator('td').nth(3)).toHaveText('6');
  await expect(page.locator('[data-month="2026-12"]').locator('td').nth(3)).toHaveText('0');
  await page.getByLabel('Monthly summary year', { exact: true }).selectOption('2025');
  await page.getByRole('button', { name: 'Jump to today', exact: true }).click();
  await expect(page.getByLabel('Monthly summary year', { exact: true })).toHaveValue('2026');
  await expect(page.locator('[data-month="2026-10"]')).toBeInViewport();
});

test('calendar month autofill preserves entries, retries failures, and feeds both summaries', async ({ page }) => {
  const state = await backend(page);
  state.logs = [entry('2026-11-02', 0, 'Leave day'), entry('2026-11-03', 6.5, 'Keep notes')];
  await page.goto('/?view=calendar');
  await page.getByText('Autofill a month with 8-hour weekdays', { exact: true }).click();
  await page.getByLabel('Month to autofill', { exact: true }).fill('2026-11');
  await expect(page.getByRole('button', { name: 'Add 19 weekday entries', exact: true })).toBeEnabled();
  state.failWrite = true;
  await page.getByRole('button', { name: 'Add 19 weekday entries', exact: true }).click();
  await expect(page.locator('.calendar-autofill [role=alert]')).toContainText('Simulated connection failure');
  expect(state.logs).toHaveLength(2);
  state.failWrite = false;
  await page.getByRole('button', { name: 'Add 19 weekday entries', exact: true }).click();
  await expect(page.locator('.calendar-autofill [role=status]')).toContainText('Added 19');
  expect(state.logs).toHaveLength(21);
  expect(state.logs.find(log => log.date === '2026-11-02')).toMatchObject({ total_hours: 0, notes: 'Leave day' });
  expect(state.logs.find(log => log.date === '2026-11-03')).toMatchObject({ total_hours: 6.5, notes: 'Keep notes' });
  expect(state.logs.find(log => log.date === '2026-11-26')?.total_hours).toBe(8);
  expect(state.logs.some(log => log.date === '2026-11-07')).toBe(false);
  await expect(page.getByRole('button', { name: 'Add 0 weekday entries', exact: true })).toBeDisabled();
  await page.reload();
  await nav(page, 'Monthly');
  await expect(page.locator('[data-month="2026-11"]').locator('td').nth(3)).toHaveText('158.5');
  await nav(page, 'POP');
  await expect(page.locator('[data-stat=pop-year-worked]')).toHaveText('158.5 h');
  expect(state.requests.filter(request => request.path.endsWith('timesheet_logs') && request.method === 'POST')).toHaveLength(2);
});

test('sample autofill stays offline and does not change personal entries', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?sample=2026');
  await page.context().setOffline(true);
  await page.getByText('Autofill a month with 8-hour weekdays', { exact: true }).click();
  await page.getByLabel('Month to autofill', { exact: true }).fill('2026-11');
  await page.getByRole('button', { name: 'Add 21 weekday entries', exact: true }).click();
  await expect(page.locator('.calendar-autofill [role=status]')).toContainText('Added 21');
  await nav(page, 'Monthly');
  await expect(page.locator('[data-month="2026-11"]').locator('td').nth(3)).toHaveText('168');
  expect(state.requests).toHaveLength(0);
  expect(state.logs).toHaveLength(1);
});
