// Server-only helper. Uses disposable users supplied by verify-supabase.mjs.
// No emails, browser traces, screenshots, or exported session files are produced.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
    stage = 'persisting leave settings and explicitly importing browser records';
    await nav('Settings');
    await page.locator('input[name=openingPto]').fill('75.25');
    await page.getByRole('button', { name: 'Save leave settings' }).click();
    await wait(() => document.querySelector('.leave-policy [role=status]')?.textContent.includes('saved'));
    stage = 'preparing explicit browser import';
    const legacy = JSON.stringify([
      { id: 'legacy-conflict', date: '2026-10-01', totalHours: 1 },
      { id: 'legacy-new', date: '2026-10-22', totalHours: 4.1 },
    ]);
    await page.evaluate(value => localStorage.setItem('work_hours_tracker_time_logs', value), legacy);
    await page.getByRole('button', { name: 'Reload Supabase data' }).click();
    await page.getByRole('button', { name: 'Import existing browser data' }).waitFor();
    await wait(() => !document.querySelector('.browser-import button')?.disabled);
    await page.getByRole('button', { name: 'Import existing browser data' }).click();
    stage = 'waiting for explicit browser import acknowledgement';
    await wait(() => document.querySelector('.supabase-settings [role=status]')?.textContent.includes('Imported 1'));
    stage = 'checking import preservation';
    assert.equal(await page.evaluate(() => localStorage.getItem('work_hours_tracker_time_logs')), legacy);
    assert.equal(await page.locator('input[name=openingPto]').inputValue(), '75.25');
    await nav('Calendar');
    stage = 'checking imported calendar records';
    await wait(() => document.querySelectorAll('.calendar-logged').length === 3);
    await page.getByRole('button', { name: 'Edit 2026-10-01', exact: true }).click();
    assert.equal(Number(await page.locator('#day-hours').inputValue()), 9);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    stage = 'refreshing a real expired session';
    const refreshesBefore = refreshes;
    await page.evaluate(key => {
      const session = JSON.parse(localStorage.getItem(key));
      session.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(key, JSON.stringify(session));
    }, storageKey);
    await page.reload();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 3);
    assert.ok(refreshes > refreshesBefore, 'Session recovery should refresh the expired session');
    stage = 'deleting a persisted entry';
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete 2026-10-21', exact: true }).click();
    await wait(() => document.querySelectorAll('.calendar-logged').length === 2);
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
    console.log('Live Chromium verified Auth callback/recovery/refresh, calculator save, cloud reload/edit/delete, leave settings, explicit non-destructive import, sign-out, and account isolation. Backend requests used TLS-verified server forwarding; no responses were mocked.');
  } catch (error) {
    // Playwright errors can contain URLs bearing tokens. Report only the stage.
    throw new Error(`Live browser verification failed while ${stage} (${error.name}); browser details omitted to protect session tokens.`);
  } finally {
    await browser.close();
  }
}
