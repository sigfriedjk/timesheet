// Server-side audit only. Read the retired configuration in memory from an
// explicitly supplied Git revision; never emit values or copy them into fixtures.
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const baseline = process.argv[2];
const assetDirectory = process.argv[3] || 'dist';
if (!baseline)
  throw new Error(
    'Usage: node scripts/audit-private-configuration.mjs <pre-migration-git-ref> [asset-directory]',
  );
const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let periods, rate;
try {
  const oldPeriods = git(['show', `${baseline}:src/config/periodsOfPerformance.ts`]);
  periods = JSON.parse(oldPeriods.match(/=\s*(\[[\s\S]*\]);/)[1]);
  const oldMath = git(['show', `${baseline}:src/utils/monthlySummary.ts`]);
  rate = Number(oldMath.match(/export const PTO_RATE\s*=\s*([^;]+)/)[1]);
  if (!Number.isFinite(rate) || !Array.isArray(periods)) throw new Error();
} catch {
  throw new Error('Cannot read the supplied pre-migration baseline; source contents omitted.');
}

async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await filesIn(file)));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}
const sourceFiles = git(['ls-files', '--cached', '--others', '--exclude-standard'])
  .trim()
  .split('\n');
const assetFiles = await filesIn(assetDirectory);
const problems = [];
let inspected = 0;
for (const file of new Set([...sourceFiles, ...assetFiles])) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    continue;
  } // Deleted tracked files are absent.
  inspected++;
  const numbers = [...text.matchAll(/(?<![\w.])(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?/gi)];
  if (numbers.some((match) => Number(match[0]) === rate))
    problems.push({ file, kind: 'retired accrual-rate literal' });
  const percentage = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (percentage.some((match) => Number(match[1]) === rate * 100))
    problems.push({ file, kind: 'retired accrual-rate percentage' });
  for (const period of periods) {
    let start = text.indexOf(period.startDate);
    while (start !== -1) {
      const window = text.slice(Math.max(0, start - 100), start + 350);
      if (
        window.includes(period.endDate) &&
        /targetHours|funded/i.test(window) &&
        [...window.matchAll(/\d+(?:\.\d+)?/g)].some(
          (match) => Number(match[0]) === period.targetHours,
        )
      ) {
        problems.push({ file, kind: 'retired POP dates and funding' });
        break;
      }
      start = text.indexOf(period.startDate, start + 1);
    }
  }
}
if (problems.length) {
  console.error(JSON.stringify({ passed: false, matches: problems }));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      passed: true,
      filesInspected: inspected,
      generatedFilesInspected: assetFiles.length,
      privateRateMatches: 0,
      privatePopMatches: 0,
    }),
  );
}
