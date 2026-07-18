#!/usr/bin/env node
/**
 * Patch the local Electron.app so `npm start` shows Anon + annona icon
 * in the macOS Dock / menu bar (CFBundle* is read at launch, not via app.setName).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron', 'dist');
const electronAppOrig = path.join(electronDir, 'Electron.app');
const electronApp = path.join(electronDir, 'Anon Browser.app');
const icnsSrc = path.join(root, 'brand', 'icon.icns');
const pathTxt = path.join(root, 'node_modules', 'electron', 'path.txt');
const installScript = path.join(root, 'node_modules', 'electron', 'install.js');

const APP_NAME = 'Anon Browser';
const EXEC_NAME = 'Anon Browser';

if (process.platform !== 'darwin') process.exit(0);

// Electron 42+ downloads its binary on first launch instead of during npm
// install. Ensure a clean checkout has a bundle available before branding it.
if (!fs.existsSync(electronAppOrig) && !fs.existsSync(electronApp)) {
  execFileSync(process.execPath, [installScript], { stdio: 'inherit' });
}

// Rename the bundle directory Electron.app -> "Anon Browser.app". macOS caches
// icons/names per bundle PATH; keeping the name "Electron.app" leaves a stale
// "Electron" ghost icon in the icon-services cache (system-level, not clearable
// without sudo). A fresh bundle path has no such cache, so the Dock/app-switcher
// read our annona icon + "Anon Browser" name immediately.
if (fs.existsSync(electronAppOrig)) {
  if (fs.existsSync(electronApp)) fs.rmSync(electronApp, { recursive: true, force: true });
  fs.renameSync(electronAppOrig, electronApp);
}
if (!fs.existsSync(electronApp) || !fs.existsSync(icnsSrc)) process.exit(0);

const plist = path.join(electronApp, 'Contents', 'Info.plist');
const icnsDst = path.join(electronApp, 'Contents', 'Resources', 'anon.icns');

function pb(args) {
  execFileSync('/usr/libexec/PlistBuddy', args, { stdio: 'ignore' });
}

function setString(key, value) {
  try {
    pb(['-c', `Set :${key} ${value}`, plist]);
  } catch {
    pb(['-c', `Add :${key} string ${value}`, plist]);
  }
}

// Avoid mutating a shared store inode if the file is hard-linked.
const tmp = `${plist}.anon`;
fs.copyFileSync(plist, tmp);
fs.renameSync(tmp, plist);

setString('CFBundleName', APP_NAME);
setString('CFBundleDisplayName', APP_NAME);
setString('CFBundleIdentifier', 'computer.anon.browser');
setString('CFBundleExecutable', EXEC_NAME);
// Point the bundle at a fresh icon filename (anon.icns) instead of the
// stock electron.icns, so LaunchServices/icon-services read it clean instead
// of serving a stale cached "Electron" ghost icon.
setString('CFBundleIconFile', 'anon.icns');

// Rename the main executable so the launched process (and thus the macOS
// app-switcher / Dock tooltip, which reflect the running binary's name)
// reads "Anon Browser" instead of "Electron". The original binary is kept.
const execSrc = path.join(electronApp, 'Contents', 'MacOS', 'Electron');
const execDst = path.join(electronApp, 'Contents', 'MacOS', EXEC_NAME);
fs.copyFileSync(execSrc, execDst);
fs.chmodSync(execDst, 0o755);

// Point the `electron` npm bin at the renamed executable so `npm start`/`dev`
// launch it directly (preserves terminal stdio). electron-builder uses its
// own cached binary for pack/dist, so this does not affect builds.
fs.writeFileSync(pathTxt, `Anon Browser.app/Contents/MacOS/${EXEC_NAME}`);

fs.copyFileSync(icnsSrc, icnsDst);
// Electron's downloaded macOS bundle is signed. Mutating its plist/executable
// invalidates that signature, and newer Electron/macOS combinations are killed
// at launch unless the development bundle is signed again.
execFileSync(
  '/usr/bin/codesign',
  ['--force', '--deep', '--sign', '-', electronApp],
  { stdio: 'ignore' }
);
console.log(`Branded Electron.app → ${APP_NAME}`);
