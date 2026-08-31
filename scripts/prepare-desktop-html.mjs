/**
 * Desktop packs must ship the SPA as dist/app.html.
 * Vite emits dist/index.html; assemble-site (web only) later swaps that file
 * for the marketing homepage. Copy before electron-builder so loadFile
 * never points at a missing path.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = join(root, 'dist', 'index.html');
const distApp = join(root, 'dist', 'app.html');

if (!existsSync(distIndex)) {
  console.error('dist/index.html not found. Run bun run build:app first.');
  process.exit(1);
}

copyFileSync(distIndex, distApp);
console.log('prepare-desktop-html: copied dist/index.html -> dist/app.html');
