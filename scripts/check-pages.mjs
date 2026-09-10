import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// Check the generated artifact, not just source configuration: no root-scoped
// resources may escape /my-day/ on the shared github.io origin.
const base = '/my-day/';
const html = await readFile('dist/index.html', 'utf8');
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
const worker = await readFile('dist/sw.js', 'utf8');
assert.equal(manifest.id, base);
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
assert.equal(manifest.display, 'standalone');
assert.ok(html.includes(`href="${base}icon-192.png"`));
for (const match of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
  assert.ok(match[1].startsWith(base), `Resource escapes Pages base: ${match[1]}`);
  await access(join('dist', match[1].slice(base.length)));
}
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(base), `Icon escapes Pages base: ${icon.src}`);
  await access(join('dist', icon.src.slice(base.length)));
}
assert.ok(worker.includes(`${base}index.html`), 'Offline fallback must use the repository path');
console.log('GitHub Pages artifact validated: paths, manifest, icons, and offline fallback.');
