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

  const bundleId = context.packager.appInfo.id;
  const helperPath = path.join(appPath, 'Contents', 'Resources', 'build', 'mac-audio-helper');
  if (existsSync(helperPath)) {
    // Keep the helper on the same TCC identity as the outer app. A
    // linker-signed `mac-audio-helper` is treated as a different client and
    // can start "successfully" while delivering silent buffers.
    execFileSync('codesign', [
      '--force',
      '--sign', '-',
      '--identifier', bundleId,
      helperPath,
    ], { stdio: 'inherit' });
  }

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign', '-',
    '--identifier', bundleId,
    `-r=designated => identifier "${bundleId}"`,
    appPath,
  ], { stdio: 'inherit' });
}
