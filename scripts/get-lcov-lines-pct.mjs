import { readFileSync } from 'node:fs';

const targetPath = process.argv[2];
if (!targetPath) {
  console.error('Usage: node scripts/get-lcov-lines-pct.mjs <path-to-lcov.info>');
  process.exit(1);
}

const content = readFileSync(targetPath, 'utf-8');
const lines = content.split('\n');

let totalLines = 0;
let coveredLines = 0;

for (const line of lines) {
  const lfMatch = line.match(/^LF:(\d+)/);
  if (lfMatch) {
    totalLines += Number(lfMatch[1]);
    continue;
  }

  const lhMatch = line.match(/^LH:(\d+)/);
  if (lhMatch) {
    coveredLines += Number(lhMatch[1]);
  }
}

if (totalLines === 0) {
  console.error('No LF entries found in lcov file.');
  process.exit(1);
}

const pct = (coveredLines / totalLines) * 100;
process.stdout.write(pct.toFixed(4));
