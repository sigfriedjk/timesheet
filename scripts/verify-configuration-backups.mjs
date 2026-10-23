// Server-only verification using the two disposable users created by verify-supabase.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

async function applicationModules() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(path.join(root, 'work'), { recursive: true });
  const directory = await mkdtemp(path.join(root, 'work/configuration-check-'));
  try {
    const pending = ['src/services/jsonBackup.ts', 'src/services/supabaseRepository.ts'];
    const seen = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      const source = await readFile(path.join(root, file), 'utf8');
      let code = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      }).outputText;
      for (const match of code.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
        pending.push(path.normalize(path.join(path.dirname(file), `${match[1]}.ts`)));
      }
      code = code.replace(/(from ['"])(\.[^'"]+)(['"])/g, '$1$2.js$3');
      const target = path.join(directory, file.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, code);
    }
    return {
      load: (file) => import(pathToFileURL(path.join(directory, file)).href),
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyConfigurationBackups({ clients, userIds }) {
  // Never run destructive verification against a caller's real account.
  for (let index = 0; index < clients.length; index++) {
    const { data, error } = await clients[index].auth.getUser();
    if (
      error ||
      data.user?.id !== userIds[index] ||
      !data.user.email?.endsWith('@example.invalid')
    ) {
      throw new Error('Configuration verification requires disposable example.invalid accounts.');
    }
  }
  const runtime = await applicationModules();
  try {
    const { createSupabaseRepository } = await runtime.load('src/services/supabaseRepository.js');
    const { exportTimesheetJson, parseTimesheetJson } = await runtime.load(
      'src/services/jsonBackup.js',
    );
    const a = createSupabaseRepository(clients[0], userIds[0]);
    const b = createSupabaseRepository(clients[1], userIds[1]);
    const original = await a.load();
    const otherBefore = await b.load();
    assert.equal(otherBefore.report.settings.ptoAccrualRate, null);
    assert.deepEqual(otherBefore.periods, []);

    const precise = structuredClone(original.report);
    precise.settings.ptoAccrualRate = 0.12345678;
    await a.saveReport(precise);
    const saved = await a.load();
    assert.equal(saved.report.settings.ptoAccrualRate, 0.12345678);
    const contents = exportTimesheetJson(saved.logs, saved.report, 'personal', saved.periods);
    assert.equal(JSON.parse(contents).version, 3);
    const backup = parseTimesheetJson(contents);
    assert.deepEqual(backup.periods, saved.periods);
    assert.equal(backup.report.settings.ptoAccrualRate, 0.12345678);

    const changed = structuredClone(precise);
    changed.settings.ptoAccrualRate = 0.25;
    await a.replaceWorkspace([], changed, []);
    await a.replaceWorkspace(backup.logs, backup.report, backup.periods);
    const restored = await a.load();
    assert.deepEqual(restored.report, saved.report);
    assert.deepEqual(restored.periods, saved.periods);
    assert.deepEqual(
      restored.logs.map(({ date, totalHours, notes }) => ({ date, totalHours, notes })),
      saved.logs.map(({ date, totalHours, notes }) => ({ date, totalHours, notes })),
    );

    const legacy = JSON.parse(contents);
    legacy.version = 2;
    delete legacy.report.settings.ptoAccrualRate;
    const oldBackup = parseTimesheetJson(JSON.stringify(legacy));
    await a.saveReport(changed);
    await a.savePeriods([]);
    await a.replaceWorkspace(oldBackup.logs, oldBackup.report, undefined);
    const retained = await a.load();
    assert.equal(retained.report.settings.ptoAccrualRate, 0.25);
    assert.deepEqual(retained.periods, []);
    await assert.rejects(
      () => b.replaceWorkspace(oldBackup.logs, oldBackup.report, []),
      /Set a valid PTO accrual rate/,
    );
    assert.deepEqual(await b.load(), otherBefore);
    const beforeFailure = await a.load();
    await assert.rejects(() =>
      a.replaceWorkspace([{ date: '2035-02-05', totalHours: 25 }], precise, backup.periods),
    );
    assert.deepEqual(await a.load(), beforeFailure);
    const crossUser = await clients[1]
      .from('timesheet_reports')
      .select('state')
      .eq('user_id', userIds[0]);
    assert.equal(crossUser.error, null);
    assert.deepEqual(crossUser.data, []);

    await a.replaceWorkspace(original.logs, original.report, original.periods);
    console.log(
      'Disposable-account verification passed: exact rate precision, complete JSON round trip, legacy rate/empty-POP preservation, missing-rate rejection, rollback, and RLS isolation.',
    );
  } finally {
    await runtime.cleanup();
  }
}
