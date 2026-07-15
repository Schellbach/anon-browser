#!/usr/bin/env node
/**
 * Patch the local Electron.app so `npm start` shows Anon + annona icon
 * in the macOS Dock / menu bar (CFBundle* is read at launch, not via app.setName).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const electronApp = path.join(
  root,
  'node_modules',
  'electron',
  'dist',
  'Electron.app'
);
const plist = path.join(electronApp, 'Contents', 'Info.plist');
const icnsSrc = path.join(root, 'brand', 'icon.icns');
const icnsDst = path.join(electronApp, 'Contents', 'Resources', 'electron.icns');

if (process.platform !== 'darwin') process.exit(0);
if (!fs.existsSync(plist) || !fs.existsSync(icnsSrc)) process.exit(0);

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

setString('CFBundleName', 'Anon');
setString('CFBundleDisplayName', 'Anon');
setString('CFBundleIdentifier', 'computer.anon.browser');

fs.copyFileSync(icnsSrc, icnsDst);
console.log('Branded Electron.app → Anon');
