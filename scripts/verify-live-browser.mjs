// Server-only helper. Uses disposable users supplied by verify-supabase.mjs.
// No emails, browser traces, screenshots, or exported session files are produced.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function verifyLiveBrowser({ site, sessions, fetch }) {
  const origin = 'https://yiqquogdutgujsacoezh.supabase.co';
  const storageKey = 'sb-yiqquogdutgujsacoezh-auth-token';
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  let stage = 'starting browser';
  try {
    const context = await browser.newContext();
    let refreshes = 0;
    let bridgeFailed = false;
    // Forward real backend traffic with the runtime's configured proxy and CA.
    // This avoids changing Chromium's trust store or disabling TLS verification.
    await context.route(`${origin}/**`, async route => {
      try {
        const request = route.request();
        if (request.url().includes('grant_type=refresh_token')) refreshes++;
        const headers = { ...request.headers() };
        delete headers.host;
        delete headers['content-length'];
        const response = await fetch(request.url(), {
          method: request.method(), headers, body: request.postDataBuffer() || undefined,
          signal: AbortSignal.timeout(20000),
        });
        const responseHeaders = Object.fromEntries(response.headers);
        delete responseHeaders['content-encoding'];
        delete responseHeaders['content-length'];
        delete responseHeaders['transfer-encoding'];
        await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
      } catch {
        bridgeFailed = true;
        await route.abort();
      }
    });
    const page = await context.newPage();
    const nav = name => page.locator('.nav-tab-btn').filter({ hasText: name }).click();
    const wait = async (expression, arg) => page.waitForFunction(expression, arg, { timeout: 20000 });
    const login = async session => {
      const callback = new URL(site);
      callback.searchParams.set('view', 'calendar');
      callback.hash = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: String(session.expires_in), token_type: 'bearer', type: 'magiclink' }).toString();
      // Model returning from an external email page, forcing a fresh document.
      // A hash-only navigation within the existing app does not reinitialize Auth.
      await page.goto('about:blank');
      await page.goto(callback.href);
      await page.locator('.year-calendar').waitFor();
      assert.equal(new URL(page.url()).hash, '', 'Auth callback should clear session tokens from the URL');
    };
    stage = 'recovering a real Auth callback';
    await login(sessions[0]);
    assert.equal(await page.locator('.calendar-logged').count(), 1);
    stage = 'saving a calculator entry to Supabase';
    await nav('Calculator');
    await page.locator('#log-date').fill('2026-10-21');
    await page.getByLabel('Time out', { exact: true }).fill('17:00');
    await page.locator('#log-notes').fill('live browser verification');
    await page.getByRole('button', { name: /Log Time to Database/ }).click();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 2);
    stage = 'reloading persisted cloud records';
    await page.reload();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 2);
    await page.getByRole('button', { name: 'Edit 2026-10-21', exact: true }).click();
    assert.equal(await page.locator('#day-notes').inputValue(), 'live browser verification');
    await page.locator('#day-hours').fill('9.2');
    await page.getByRole('button', { name: 'Save hours', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    stage = 'persisting leave settings';
    await nav('Settings');
    await page.locator('input[name=openingPto]').fill('75.25');
    await page.getByRole('button', { name: 'Save leave settings' }).click();
    await wait(() => document.querySelector('.leave-policy [role=status]')?.textContent.includes('saved'));
    stage = 'editing persisted POP definitions';
    await page.getByRole('button', { name: 'Edit Verification POP', exact: true }).click();
    const popEditor = page.getByRole('form', { name: 'Edit POP' });
    await popEditor.getByLabel('POP name').fill('Edited live POP');
    await popEditor.getByLabel('Funded hours').fill('1700.5');
    await page.getByRole('button', { name: 'Save POP', exact: true }).click();
    await wait(() => document.querySelector('.pop-settings [role=status]')?.textContent.includes('POP definitions saved'));
    await page.reload();
    await nav('Settings');
    await page.getByRole('button', { name: 'Edit Edited live POP', exact: true }).waitFor();
    stage = 'checking removed browser migration controls';
    assert.equal(await page.getByRole('button', { name: 'Import existing browser data' }).count(), 0);
    stage = 'importing a JSON file into the real account';
    const json = JSON.stringify({ format: 'timesheet', version: 2, dataset: 'personal', logs: [{ date: '2026-10-01', totalHours: 1, notes: 'Restored' }, { date: '2026-10-23', totalHours: 5.2 }],
      report: { ptoPolicyVersion: 1, settings: { openingMonth: '2026-01', openingPto: 999, openingHoliday: 25, openingBirthday: 3, workPercent: 90, autoPto: false },
        entries: ['pto', 'holiday', 'birthday', 'overhead', 'adjustment'].map((category, i) => ({ id: category, date: '2026-10-05', category, hours: i === 4 ? -1.25 : i + 1, notes: `Restored ${category}` })), projectedWork: { '2026-11': 120 } },
      periods: [{ id: 'restored', name: 'Restored POP', startDate: '2026-01-01', endDate: '2026-12-31', targetHours: 1900 }] });
    await page.getByLabel('JSON file', { exact: true }).setInputFiles({ name: 'live-backup.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await wait(() => !!document.querySelector('.json-import-preview'));
    assert.equal(await page.getByRole('button', { name: 'Import JSON', exact: true }).isDisabled(), true);
    await page.getByLabel('Replace all data in My data with this file.').check();
    await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await wait(() => document.querySelector('.data-transfer-settings [role=status]')?.textContent.includes('Replaced this workspace with 2 time entries'));
    stage = 'exporting a real cloud JSON backup';
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const download = await downloading;
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.logs.length, 2);
    assert.equal(exported.logs.find(log => log.date === '2026-10-01').totalHours, 1);
    assert.equal(exported.logs.find(log => log.date === '2026-10-23').totalHours, 5.2);
    assert.equal(exported.report.settings.openingPto, 999);
    assert.equal(exported.report.entries.length, 5);
    assert.equal(exported.report.projectedWork['2026-11'], 120);
    assert.equal(exported.periods[0].name, 'Restored POP');
    assert.equal(exported.periods[0].targetHours, 1900);
    assert.ok(!/access_token|refresh_token|user_id|birthdayMonth|monthlyBalances/.test(JSON.stringify(exported)));
    await nav('Calendar');
    stage = 'checking imported calendar records';
    await wait(() => document.querySelectorAll('.calendar-logged').length === 2);
    await page.getByRole('button', { name: 'Edit 2026-10-01', exact: true }).click();
    assert.equal(Number(await page.locator('#day-hours').inputValue()), 1);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    stage = 'refreshing a real expired session';
    const refreshesBefore = refreshes;
    await page.evaluate(key => {
      const session = JSON.parse(localStorage.getItem(key));
      session.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(key, JSON.stringify(session));
    }, storageKey);
    await page.reload();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 2);
    assert.ok(refreshes > refreshesBefore, 'Session recovery should refresh the expired session');
    stage = 'deleting a persisted entry';
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete 2026-10-23', exact: true }).click();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 1);
    stage = 'signing out and switching accounts';
    await nav('Settings');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    stage = 'waiting for sign-out acknowledgement';
    await page.locator('#supabase-email').waitFor();
    await nav('Calendar');
    await page.locator('.supabase-access').waitFor();
    assert.equal(await page.locator('.calendar-logged').count(), 0);
    stage = 'recovering the second account callback';
    await login(sessions[1]);
    stage = 'checking the second account data';
    assert.equal(await page.locator('.calendar-logged').count(), 1);
    await page.getByRole('button', { name: 'Edit 2026-10-01', exact: true }).click();
    assert.equal(Number(await page.locator('#day-hours').inputValue()), 3);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await nav('Settings');
    assert.equal(await page.locator('input[name=openingPto]').inputValue(), '0');
    assert.equal(bridgeFailed, false, 'All live requests must complete through the configured proxy');
    console.log('Live Chromium verified Auth recovery/refresh, cloud CRUD, editable POPs, complete JSON export and confirmed replacement of logs/leave/settings/POPs, sign-out, and account isolation. Backend requests used TLS-verified server forwarding; no responses were mocked.');
  } catch (error) {
    // Playwright errors can contain URLs bearing tokens. Report only the stage.
    throw new Error(`Live browser verification failed while ${stage} (${error.name}); browser details omitted to protect session tokens.`);
  } finally {
    await browser.close();
  }
}
