import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
const mode = process.argv[2] || 'dev';
if (!['dev','preview','lint','test','build','verify','build:pages','preview:pages','verify:pages'].includes(mode)) {
  console.error('Choose dev, preview, lint, test, build, verify, build:pages, preview:pages, or verify:pages.');
  process.exit(1);
}
const nodeDirectory = dirname(process.execPath);
const bundledRuntimeRoot = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'OpenAI/Codex/runtimes/cua_node') : '';
const bundledNpm = existsSync(bundledRuntimeRoot)
  ? readdirSync(bundledRuntimeRoot).map(name => join(bundledRuntimeRoot, name, 'bin/node_modules/npm/bin/npm-cli.js'))
  : [];
const npm = [
  join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'),
  join(nodeDirectory, '../node_modules/npm/bin/npm-cli.js'),
  join(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js'),
  ...bundledNpm,
].find(existsSync);
if (!npm) {
  console.error('npm was not found next to Node.js. Install the standard Node.js distribution with npm.');
  process.exit(1);
}
const environment = {...process.env};
const inheritedPath = process.env.Path || process.env.PATH || '';
// Normalize duplicate Windows PATH keys supplied by some host applications.
for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
environment.Path = `${nodeDirectory};${inheritedPath}`;
function run(args) {
  const result = spawnSync(process.execPath, [npm, ...args], {stdio:'inherit',env:environment});
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync('node_modules')) run(['ci','--cache','./work/npm-cache','--no-audit','--no-fund']);
const commands = mode === 'verify' ? ['lint','test','build'] : mode === 'verify:pages' ? ['lint','test','build:pages'] : [mode];
for (const command of commands) run(['run',command]);
