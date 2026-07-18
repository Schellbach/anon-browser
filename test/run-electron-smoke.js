const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'anon-electron-43-'));
const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js');
const env = {
  ...process.env,
  ANON_ELECTRON_SMOKE: '1',
  ANON_SMOKE_ROOT: smokeRoot,
};
delete env.ELECTRON_RUN_AS_NODE;

const brand = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'brand-electron-app.js')],
  { cwd: root, env, stdio: 'inherit' }
);
if (brand.status !== 0) {
  fs.rmSync(smokeRoot, { recursive: true, force: true });
  process.exit(brand.status || 1);
}

const child = spawn(process.execPath, [electronCli, '.', '--smoke-test'], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let sawSuccess = false;
child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  if (text.includes('Electron smoke passed:')) sawSuccess = true;
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

let timedOut = false;
let forceKillTimer;
const timer = setTimeout(() => {
  timedOut = true;
  console.error('Electron smoke test exceeded 120 seconds');
  child.kill('SIGTERM');
  forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 3_000);
}, 120_000);

child.once('error', (error) => {
  clearTimeout(timer);
  clearTimeout(forceKillTimer);
  fs.rmSync(smokeRoot, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  clearTimeout(timer);
  clearTimeout(forceKillTimer);
  fs.rmSync(smokeRoot, { recursive: true, force: true });
  if (timedOut) {
    process.exitCode = 1;
  } else if (signal) {
    console.error(`Electron smoke test terminated by ${signal}`);
    process.exitCode = 1;
  } else if (code !== 0 || !sawSuccess) {
    if (!sawSuccess) console.error('Electron smoke test exited without success marker');
    process.exitCode = code || 1;
  } else {
    process.exitCode = 0;
  }
});
