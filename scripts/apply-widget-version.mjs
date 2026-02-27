import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const packageJsonPath = resolve(rootDir, 'package.json');
const cliArgs = process.argv.slice(2);

let distDir = 'dist';
let isMinified = false;
let explicitVersion = '';

for (let index = 0; index < cliArgs.length; index += 1) {
  const arg = cliArgs[index];
  if (arg === '--min' || arg === '--minified') {
    isMinified = true;
    continue;
  }

  if (arg === '--dist-dir') {
    const nextArg = cliArgs[index + 1];
    if (!nextArg) {
      throw new Error('Missing value for --dist-dir');
    }
    distDir = nextArg;
    index += 1;
    continue;
  }

  if (arg.startsWith('--dist-dir=')) {
    distDir = arg.slice('--dist-dir='.length);
    continue;
  }

  if (arg === '--version') {
    const nextArg = cliArgs[index + 1];
    if (!nextArg) {
      throw new Error('Missing value for --version');
    }
    explicitVersion = nextArg;
    index += 1;
    continue;
  }

  if (arg.startsWith('--version=')) {
    explicitVersion = arg.slice('--version='.length);
  }
}

const infoJsonPath = resolve(rootDir, distDir, 'info.json');

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
const infoJson = JSON.parse(await readFile(infoJsonPath, 'utf-8'));

const version = String(explicitVersion || packageJson.version || '').trim();
if (!version) {
  throw new Error('version is empty');
}

const versionLabel = isMinified ? `${version}-min` : version;
const versionForHandle = versionLabel.replace(/\./g, '-');
infoJson.handle = `mindbox-v${versionForHandle}`;
infoJson.name = {
  ...(infoJson.name && typeof infoJson.name === 'object' ? infoJson.name : {}),
  ru: `Mindbox v${versionLabel}`
};

await writeFile(infoJsonPath, `${JSON.stringify(infoJson, null, 2)}\n`, 'utf-8');
