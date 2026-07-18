/**
 * One-shot diagnostic: load a URL and print color-scheme / background facts.
 * Usage: env -u ELECTRON_RUN_AS_NODE electron scripts/diagnose-theme.js [url]
 */
const { app, BrowserWindow, BrowserView, nativeTheme } = require('electron');
const path = require('path');

app.commandLine.appendSwitch(
  'disable-features',
  'WebContentsForceDark,WebContentsForceDarkInvertVisuals,CSSColorSchemeUARendering,AutoDarkModeForWebContents'
);
nativeTheme.themeSource = 'light';

const url = process.argv.find((a) => /^https?:|^data:/i.test(a)) || 'https://example.com/';

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'light';
  console.log('nativeTheme.themeSource', nativeTheme.themeSource);
  console.log('shouldUseDarkColors', nativeTheme.shouldUseDarkColors);

  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#0a0a0b',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../src/preload-content.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      disableBlinkFeatures: 'CSSColorSchemeUARendering',
    },
  });
  view.setBackgroundColor('#ffffffff');
  win.setBrowserView(view);
  view.setBounds({ x: 0, y: 0, width: 1100, height: 800 });

  const wc = view.webContents;
  const LIGHT = `html{color-scheme:only light!important;background-color:#fff!important}`;

  const dump = async (label) => {
    try {
      const info = await wc.executeJavaScript(`({
        href: location.href,
        darkMq: window.matchMedia('(prefers-color-scheme: dark)').matches,
        lightMq: window.matchMedia('(prefers-color-scheme: light)').matches,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null,
        bodyColor: document.body ? getComputedStyle(document.body).color : null,
        htmlScheme: getComputedStyle(document.documentElement).colorScheme,
      })`);
      console.log(label, JSON.stringify(info));
    } catch (e) {
      console.log(label, 'exec failed', e.message);
    }
  };

  wc.on('did-fail-load', (_e, code, desc, u, main) => {
    if (main) console.log('did-fail-load', code, desc, u);
  });
  wc.on('dom-ready', async () => {
    console.log('dom-ready');
    await wc.insertCSS(LIGHT);
    await dump('at-dom-ready');
  });
  wc.on('did-finish-load', async () => {
    console.log('did-finish-load');
    await wc.insertCSS(LIGHT);
    await dump('at-finish');
    setTimeout(() => app.quit(), 500);
  });

  console.log('loading', url);
  wc.loadURL(url);
  setTimeout(() => {
    console.log('timeout — quitting');
    dump('at-timeout').finally(() => app.quit());
  }, 20000);
});
