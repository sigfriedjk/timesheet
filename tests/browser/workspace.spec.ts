import { expect, test, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { POP_PERIODS } from '../../src/config/periodsOfPerformance';

const HOST = 'https://yiqquogdutgujsacoezh.supabase.co';
const A = '11111111-1111-4111-8111-111111111111';
const report = { ptoPolicyVersion: 1, settings: { openingMonth: '2026-01', openingPto: 0, openingHoliday: 0, openingBirthday: 0, workPercent: 100, autoPto: true }, entries: [], projectedWork: {} };
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
    else if (path.endsWith('/rpc/import_browser_timesheet')) {
      const missing = body.p_logs.filter((log: { date: string }) => !state.logs.some(existing => existing.date === log.date));
      state.logs.push(...missing.map((log: any) => entry(log.date, log.total_hours, log.notes)));
      data = missing.length;
    }
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
      if (method === 'POST') { const log = entry(body.date, body.total_hours, body.notes); state.logs = [log, ...state.logs.filter(item => item.date !== body.date)]; data = log; }
      else if (method === 'DELETE') { const date = new URL(request.url()).searchParams.get('date')!.slice(3); state.logs = state.logs.filter(item => item.date !== date); data = [{ date }]; }
      else data = state.logs;
    } else throw new Error(`Unexpected Supabase endpoint: ${path}`);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  if (signedIn) await page.addInitScript(({ A }) => {
    const token = `header.${btoa(JSON.stringify({ sub: A, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }))}.test`;
    localStorage.setItem('sb-yiqquogdutgujsacoezh-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: A, email: 'test@example.invalid', aud: 'authenticated' } }));
  }, { A });
  return state;
}
const nav = (page: Page, name: string) => page.locator('.nav-tab-btn').filter({ hasText: name }).click();

test('Settings exposes JSON controls while signed out and explains when old browser data is absent', async ({ page }) => {
  await backend(page, false);
  await page.goto('/?view=settings');
  await expect(page.getByRole('heading', { name: 'Import & export JSON' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import JSON', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import existing browser data' })).toBeVisible();
  await expect(page.getByText('No previous personal records were found in this browser.', { exact: false })).toBeVisible();
});

test('exports all saved inputs and requires confirmation before replacing every section; failed restores can retry', async ({ page }) => {
  const state = await backend(page);
  state.logs.push(entry('2026-10-02', 7, 'removed by replacement'));
  await page.goto('/?view=settings');
  const card = page.locator('.data-transfer-settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.logs).toHaveLength(2);
  expect(backup.logs[0].totalHours).toBe(8);
  expect(backup.report).toEqual(report);
  expect(backup.periods).toEqual(POP_PERIODS);
  expect(backup.version).toBe(2);
  expect(JSON.stringify(backup)).not.toMatch(/birthdayMonth|monthlyBalances/);
  expect(JSON.stringify(backup)).not.toMatch(/access_token|refresh_token|user_id/);
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('[{"date":"2026-02-30","totalHours":8}]') });
  await expect(card.getByRole('alert')).toContainText('Invalid date');
  expect(state.requests.filter(request => request.path.includes('/rpc/'))).toHaveLength(0);
  const restoredReport = { ...report, settings: { ...report.settings, openingPto: 123, openingHoliday: 45, openingBirthday: 6, autoPto: false, workPercent: 90 },
    entries: ['pto', 'holiday', 'birthday', 'overhead', 'adjustment'].map((category, i) => ({ id: category, date: '2026-10-05', category, hours: i === 4 ? -1.25 : i + 1, notes: `Restore ${category}` })), projectedWork: { '2026-11': 120 } };
  const restoredPeriods = [{ ...POP_PERIODS[0], name: 'Restored POP', startDate: '2026-01-01', endDate: '2026-12-31', targetHours: 1800 }];
  const replacement = { format: 'timesheet', version: 2, dataset: 'personal', logs: [{ date: '2026-10-01', totalHours: 1 }, { date: '2026-10-22', totalHours: 4.1 }], report: restoredReport, periods: restoredPeriods };
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await expect(card.locator('.json-import-preview')).toContainText('2 time entries; 5 leave/adjustment entries; 1 POPs');
  await expect(page.getByRole('button', { name: 'Import JSON', exact: true })).toBeDisabled();
  await page.getByLabel('Replace all data in My data with this file.').check();
  state.failWrite = true;
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Simulated connection failure');
  await expect(card.locator('.json-import-preview')).toBeVisible();
  state.failWrite = false;
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
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

test('sample JSON import and export work offline with zero Supabase requests', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?sample=2026&view=settings');
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeEnabled();
  await page.context().setOffline(true);
  await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from('[{"date":"2026-10-22","totalHours":4.1}]') });
  await expect(page.getByText('This older file is incomplete.', { exact: false })).toBeVisible();
  await page.getByLabel('Replace all data in 2026 sample data with this file.').check();
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await expect(page.locator('.data-transfer-settings').getByRole('status')).toContainText('Replaced this workspace with 1 time entries');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.dataset).toBe('sample2026');
  expect(backup.logs).toHaveLength(1);
  expect(backup.periods).toHaveLength(24);
  expect(state.requests).toHaveLength(0);
});

test('POP names, dates and funding persist, update summaries, and stay isolated from sample data', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?view=settings');
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
  await expect(page.getByRole('button', { name: 'Edit Custom Q', exact: true })).toBeVisible();
  await nav(page, 'POP');
  await expect(page.locator('[data-pop=pop-q]')).toContainText('Custom Q');
  await expect(page.locator('[data-pop=pop-q]')).toContainText('800.0');
  await nav(page, 'Settings');
  await page.locator('input[value=sample2026]').check();
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
  await expect(page.locator('[data-stat=year-hours]')).toHaveText('1210.7');
  await nav(page, 'POP');
  await expect(page.locator('[data-stat=pop-worked]')).toHaveText('1210.7');
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
  await expect(page.locator('[data-stat=year-hours]')).toHaveText('1210.7');
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
  expect(state.logs.find(item => item.date === '2026-10-21')?.total_hours).toBe(8.5);
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

test('report and leave settings preserve drafts on failure and persist on retry', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/?view=monthly');
  await page.getByRole('button', { name: 'Edit October 2026 leave and projection' }).click();
  await page.getByRole('dialog').getByLabel('Note', { exact: true }).fill('leave draft');
  state.failWrite = true;
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Simulated');
  await expect(page.getByRole('dialog').getByLabel('Note', { exact: true })).toHaveValue('leave draft');
  state.failWrite = false;
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('PTO entry saved');
  await expect(page.getByRole('dialog').getByLabel('Note', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await nav(page, 'Settings');
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
