/**
 * After Vite builds the SPA into dist/, assemble the marketing site as the public root
 * and keep the app reachable via app.html + route rewrites.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const promo = join(root, 'promo-site');

if (!existsSync(dist)) {
  console.error('dist/ not found. Run vite build first.');
  process.exit(1);
}

const appHtml = join(dist, 'app.html');
const distIndex = join(dist, 'index.html');

// SPA shell becomes app.html
if (existsSync(distIndex)) {
  if (existsSync(appHtml)) rmSync(appHtml);
  renameSync(distIndex, appHtml);
}

// Copy marketing pages (skip vercel.json / gitignore)
const skip = new Set(['vercel.json', '.gitignore']);
for (const name of ['index.html', 'download.html', 'assets', 'docs']) {
  const from = join(promo, name);
  const to = join(dist, name);
  if (!existsSync(from)) {
    console.warn(`skip missing promo path: ${name}`);
    continue;
  }
  if (skip.has(name)) continue;
  if (existsSync(to) && name !== 'assets') {
    rmSync(to, { recursive: true, force: true });
  }
  cpSync(from, to, { recursive: true });
}

// Ensure marketing assets land under /assets without wiping SPA hashed bundles.
// Promo assets are copied into dist/assets alongside vite assets (no name clash expected).
const promoAssets = join(promo, 'assets');
const distAssets = join(dist, 'assets');
if (existsSync(promoAssets)) {
  mkdirSync(distAssets, { recursive: true });
  cpSync(promoAssets, distAssets, { recursive: true });
}

// Normalize absolute app entry is still /app.html — leave as is.
// Write a tiny marker for debugging deploys.
writeFileSync(
  join(dist, '.site-build.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      hasApp: existsSync(appHtml),
      hasMarketing: existsSync(join(dist, 'index.html')),
      hasDocs: existsSync(join(dist, 'docs', 'index.html')),
    },
    null,
    2
  )
);

console.log('assemble-site: marketing root + app.html ready');
console.log(`  app: ${existsSync(appHtml)}`);
console.log(`  marketing index: ${existsSync(join(dist, 'index.html'))}`);
console.log(`  docs: ${existsSync(join(dist, 'docs', 'index.html'))}`);
