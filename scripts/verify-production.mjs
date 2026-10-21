import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const site = new URL(process.argv[2] || 'https://sigfriedjk.github.io/timesheet/');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { site: site.href, checkedAt: new Date().toISOString(), responses: [], pages: [] };
const output = path.resolve('work/production-check');
await fs.mkdir(output, { recursive: true });

async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
      const body = await response.text();
      const contentType = response.headers.get('content-type') || '';
      console.log(`HTTP ${response.status} ${url} (${contentType})`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
      report.responses.push({ url: String(url), status: response.status, contentType });
      return { body, contentType };
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
      if (attempt < 5) await delay(5000);
    }
  }
  throw new Error(`Cannot reach ${url}: ${lastError.message}`);
}

let browser;
let ws;
let profile;
const pending = new Map();
let sequence = 0;
try {
  const { body } = await get(site);
  await fs.writeFile(path.join(output, 'index.html'), body);
  if (!body.includes('id="root"')) throw new Error('Production URL did not return the application HTML');
  const assets = [...body.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => new URL(match[1], site));
  if (!assets.some(url => url.pathname.endsWith('.js'))) throw new Error('Application JavaScript is missing from HTML');
  for (const asset of assets) {
    const result = await get(asset);
    if (!/javascript|text\/css/.test(result.contentType)) throw new Error(`Wrong asset content type: ${asset}`);
  }

  const chrome = ['google-chrome', 'chromium', 'chromium-browser'].map(name => {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    return found.status === 0 ? found.stdout.trim() : null;
  }).find(Boolean);
  if (!chrome) throw new Error('Chrome/Chromium is required for the production browser check');
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'timesheet-smoke-'));
  let stderr = '';
  browser = spawn(chrome, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr.on('data', data => { stderr += data.toString(); });
  let endpoint;
  for (let i = 0; i < 150; i++) {
    endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if (endpoint) break;
    if (browser.exitCode !== null) throw new Error(`Chrome exited: ${stderr.slice(-600)}`);
    await delay(100);
  }
  if (!endpoint) throw new Error(`Chrome did not start: ${stderr.slice(-600)}`);
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const exceptions = [];
  const networkErrors = [];
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed') networkErrors.push(message.params.errorText);
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  for (const [name, url, selector] of [
    ['normal', site.href, '.calculator-view'],
    ['sample', new URL('?sample=2026', site).href, '.year-calendar'],
    ['monthly', new URL('?sample=2026&view=monthly', site).href, '.monthly-view'],
  ]) {
    await send('Page.navigate', { url }, sessionId);
    let ready = false;
    for (let i = 0; i < 200; i++) {
      ready = await evaluate(name === 'monthly' ? `document.querySelector('[data-stat=year-hours]')?.textContent === '1210.7'` : name === 'sample' ? `document.querySelectorAll('.calendar-logged').length === 149` : `!!document.querySelector(${JSON.stringify(selector)})`);
      if (ready) break;
      await delay(200);
    }
    const html = await evaluate('document.documentElement.outerHTML');
    await fs.writeFile(path.join(output, `${name}.html`), html || '');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    if (!ready) throw new Error(`${name} page did not render. Exceptions: ${exceptions.join('; ')}. Network: ${networkErrors.join('; ')}. Page: ${String(await evaluate('document.body.innerText')).slice(0, 500)}`);
    if (name === 'sample') {
      const counts = await evaluate('({ months: document.querySelectorAll(".month-calendar").length, dates: document.querySelectorAll(".calendar-day").length, entries: document.querySelectorAll(".calendar-logged").length })');
      if (counts.months !== 12 || counts.dates !== 365 || counts.entries !== 149) throw new Error(`Sample page counts are wrong: ${JSON.stringify(counts)}`);
      const cleanCalendar = await evaluate(`!document.querySelector('.sample-banner, .sample-coverage, .month-totals, .month-target, .month-holidays, .calendar-view h2, .app-footer') && !document.querySelector('.year-calendar').innerText.toLowerCase().includes('sample')`);
      if (!cleanCalendar) throw new Error('Calendar contains removed sample controls, title, or month-card details');
      report.pages.push({ name, url, rendered: true, ...counts });
    } else if (name === 'monthly') {
      const summary = await evaluate(`({ rows: document.querySelectorAll('.monthly-table tbody tr').length, actual: Number(document.querySelector('[data-stat=year-hours]').textContent), forecast: Number(document.querySelector('.monthly-table tfoot tr').children[4].textContent), currentLeave: parseFloat(document.querySelector('[data-stat=current-leave]').textContent), projectedLeave: parseFloat(document.querySelector('[data-stat=year-end-leave]').textContent) })`);
      if (summary.rows !== 12 || summary.actual !== 1210.7 || !(summary.forecast > summary.actual) || !Number.isFinite(summary.currentLeave) || !Number.isFinite(summary.projectedLeave)) throw new Error(`Monthly report failed: ${JSON.stringify(summary)}`);
      const automaticPto = await evaluate(`({ january: Number(document.querySelector('[data-month="2026-01"]').children[11].textContent), february: Number(document.querySelector('[data-month="2026-02"]').children[11].textContent) })`);
      if (automaticPto.january !== 17.7 || automaticPto.february !== 152) throw new Error(`Automatic PTO gaps failed: ${JSON.stringify(automaticPto)}`);
      report.pages.push({ name, url, rendered: true, ...summary });
    } else report.pages.push({ name, url, rendered: true });
    console.log(`Chrome verified ${name} page: ${url}`);
  }
  await evaluate(`Array.from(document.querySelectorAll('.nav-tab-btn')).find(button => button.textContent.trim() === 'Settings').click()`);
  for (let i = 0; i < 50 && !await evaluate(`!!document.querySelector('.settings-view')`); i++) await delay(100);
  if (!await evaluate(`!!document.querySelector('.settings-view input[value=sample2026]:checked') && !!document.querySelector('.settings-view .sample-coverage')`)) throw new Error('Settings is missing the active sample selection or coverage/downloads');
  if (!await evaluate(`document.querySelector('input[name=autoPto]')?.checked === true`)) throw new Error('Automatic historical PTO must be enabled by default');
  await evaluate(`document.querySelector('.dataset-selector input[value=personal]').click()`);
  for (let i = 0; i < 50 && !await evaluate(`!!document.querySelector('.settings-view input[value=personal]:checked')`); i++) await delay(100);
  if (!await evaluate(`!!document.querySelector('.settings-view input[value=personal]:checked') && !location.search.includes('sample')`)) throw new Error('Switching to personal data must stay in Settings and clear the sample query');
  await evaluate(`document.querySelector('.dataset-selector input[value=sample2026]').click()`);
  for (let i = 0; i < 50 && !await evaluate(`!!document.querySelector('.settings-view input[value=sample2026]:checked')`); i++) await delay(100);
  if (!await evaluate(`!!document.querySelector('.settings-view input[value=sample2026]:checked')`)) throw new Error('Switching to sample data must stay in Settings');
  report.settings = { sourceSelection: true, sampleControls: true, staysInSettings: true };
  console.log('Chrome verified Settings sample controls and data-source switching.');
  if (exceptions.length) throw new Error(`Browser errors: ${exceptions.join('; ')}`);
  report.success = true;
  console.log('Production HTTP, JavaScript/CSS, calculator, calendar, monthly report, and Settings checks passed.');
} catch (error) {
  report.success = false;
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (ws) ws.close();
  for (const item of pending.values()) clearTimeout(item.timer);
  if (browser) {
    browser.kill('SIGTERM');
    await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(3000)]);
  }
  if (profile) await fs.rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
