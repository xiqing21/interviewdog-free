import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Developer ID signing takes precedence when it is configured. For local
 * unsigned builds, apply one stable ad-hoc outer signature using the product
 * bundle identifier. This keeps macOS TCC from treating every rebuilt Electron
 * shell as a separate permission client.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  if (!existsSync(appPath)) {
    throw new Error(`Expected packaged app was not found: ${appPath}`);
  }

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign', '-',
    '--identifier', context.packager.appInfo.id,
    `-r=designated => identifier "${context.packager.appInfo.id}"`,
    appPath,
  ], { stdio: 'inherit' });
}
