import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Copy static assets (manifest.json, popup.html, settings.html) into dist/.
cpSync(join(root, 'public'), dist, { recursive: true });

const entryPoints = ['content', 'popup', 'settings'].map(
  (name) => join(root, 'src', `${name}.ts`),
);

await build({
  entryPoints,
  outdir: dist,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'info',
});
