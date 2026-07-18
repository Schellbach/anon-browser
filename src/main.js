const {
  app,
  BaseWindow,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  Menu,
  dialog,
  nativeImage,
  nativeTheme,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { Wallet } = require('./wallet');
const { AppStore } = require('./store');
const { attachPrivacyToSession, sessionFor, applyTorProxy } = require('./privacy-session');
const { initFilterEngine, engineStatus, cosmeticStylesForUrl } = require('./filter-engine');
const { siteCosmeticCss, siteCosmeticScript } = require('./cosmetics');
const { attachDownloads, listLive, cancelDownload } = require('./downloads');
const { parseBookmarksFile } = require('./bookmark-import');
const { detectTor, isOnionUrl, normalizeOnionInput } = require('./tor');
const { searchUrl } = require('./search');
const { parseCoinInput, formatCoin } = require('../vault/coins');
const { buildChromiumUserAgent } = require('./user-agent');

const IS_SMOKE_TEST =
  process.env.ANON_ELECTRON_SMOKE === '1' && process.argv.includes('--smoke-test');
const SMOKE_ROOT = process.env.ANON_SMOKE_ROOT;
if (IS_SMOKE_TEST) {
  if (!SMOKE_ROOT) throw new Error('ANON_SMOKE_ROOT is required for smoke tests');
  const userData = path.join(SMOKE_ROOT, 'user-data');
  const downloads = path.join(SMOKE_ROOT, 'downloads');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(downloads, { recursive: true });
  app.setPath('userData', userData);
  app.setPath('downloads', downloads);
}

// Electron's default user agent exposes the shell and exact Electron version.
// Use Chromium's reduced UA shape while retaining the actual Chromium major.
app.userAgentFallback = buildChromiumUserAgent();

// Dark app chrome must not force-darken web pages (black bg + black text).
app.commandLine.appendSwitch(
  'disable-features',
  [
    'WebContentsForceDark',
    'WebContentsForceDarkInvertVisuals',
    'CSSColorSchemeUARendering',
    'AutoDarkModeForWebContents',
  ].join(',')
);

// Pages should see prefers-color-scheme: light even when macOS is in dark mode.
// Our chrome UI is custom CSS (stays dark); this only affects website media queries.
nativeTheme.themeSource = 'light';

const APP_ICON = path.join(__dirname, '../brand/icon.png');

const wallet = new Wallet();
/** @type {AppStore} */
let store;

/** host -> boolean */
const siteShields = new Map();

/** @type {{ ok: boolean, host: string, port: number } | null} */
let torStatus = null;

const TOOLBAR_HEIGHT = 72;
const BOOKMARKS_HEIGHT = 28;
const FIND_HEIGHT = 34;
const HOME_URL = 'anon://newtab';
const INTERNAL_TAB_FILES = new Set([
  'newtab.html',
  'vault.html',
  'agent.html',
  'settings.html',
  'history.html',
  'bookmarks.html',
  'downloads.html',
]);

/** @type {Map<number, WindowState>} */
const windows = new Map();

/** @type {Set<number>} webContents IDs that are trusted internal pages */
const internalWebContents = new Set();

class WindowState {
  /**
   * @param {Electron.BaseWindow} win
   * @param {'normal' | 'private' | 'tor'} mode
   */
  constructor(win, mode = 'normal') {
    this.win = win;
    this.mode = mode;
    this.isPrivate = mode === 'private' || mode === 'tor';
    this.isTor = mode === 'tor';
    this.tabs = [];
    this.activeTabId = null;
    this.tabSeq = 0;
    this.activeView = null;   // Currently visible tab's view
    /** @type {Electron.WebContentsView | null} */
    this.chromeView = null;   // Toolbar / omnibox (sibling of tab views)
    this.chromeReady = false;
    this.findVisible = false;
  }

  chromeWebContents() {
    return this.chromeView?.webContents || null;
  }

  chromeHeight() {
    const showBar = store.settings.showBookmarksBar && this.mode === 'normal';
    return (
      TOOLBAR_HEIGHT +
      (showBar ? BOOKMARKS_HEIGHT : 0) +
      (this.findVisible ? FIND_HEIGHT : 0)
    );
  }
}

function isAnonUrl(url) {
  return typeof url === 'string' && url.startsWith('anon://');
}

function resolveAnonUrl(url) {
  const map = {
    'anon://newtab': 'newtab.html',
    'anon://home': 'newtab.html',
    'anon://vault': 'vault.html',
    'anon://agent': 'agent.html',
    'anon://settings': 'settings.html',
    'anon://history': 'history.html',
    'anon://bookmarks': 'bookmarks.html',
    'anon://downloads': 'downloads.html',
  };
  const file = map[url] || 'newtab.html';
  return path.join(__dirname, '../renderer', file);
}

function isTrustedInternalFileUrl(url) {
  try {
    const filePath = fileURLToPath(url);
    const rendererDir = path.resolve(__dirname, '../renderer');
    return (
      path.dirname(path.resolve(filePath)) === rendererDir &&
      INTERNAL_TAB_FILES.has(path.basename(filePath))
    );
  } catch {
    return false;
  }
}

function isTrustedChromeFileUrl(url) {
  try {
    return path.resolve(fileURLToPath(url)) === path.resolve(__dirname, '../renderer/chrome.html');
  } catch {
    return false;
  }
}

function anonTitle(url) {
  const map = {
    'anon://newtab': 'New Tab',
    'anon://home': 'New Tab',
    'anon://vault': 'Vault',
    'anon://agent': 'Agent',
    'anon://settings': 'Settings',
    'anon://history': 'History',
    'anon://bookmarks': 'Bookmarks',
    'anon://downloads': 'Downloads',
  };
  return map[url] || 'Anon';
}

function hostKey(url) {
  try {
    if (isAnonUrl(url)) return 'anon';
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function shieldsForUrl(url) {
  const host = hostKey(url);
  if (!host || host === 'anon') return false;
  if (siteShields.has(host)) return siteShields.get(host);
  return !!store.settings.globalShields;
}

/**
 * Sensitive IPC (vault, settings, data) may only be called from trusted
 * internal pages (chrome UI or anon:// internal pages), never from web content.
 * 
 * Security: Check against allowlist of known internal webContents IDs.
 * This is stronger than URL-based checks which can be spoofed.
 */
function isInternalSender(e) {
  const id = e.sender?.id;
  if (id == null) return false;
  const senderUrl = e.senderFrame?.url || e.sender.getURL();
  
  // Chrome UI webContents are always internal
  for (const st of windows.values()) {
    const chrome = st.chromeWebContents();
    if (chrome && chrome.id === id) return isTrustedChromeFileUrl(senderUrl);
  }

  // Content view must be explicitly marked as internal
  return internalWebContents.has(id) && isTrustedInternalFileUrl(senderUrl);
}

/**
 * Check if sender is chrome UI only (not content, even if internal content)
 */
function isChromeSender(e) {
  const id = e.sender?.id;
  if (id == null) return false;
  const senderUrl = e.senderFrame?.url || e.sender.getURL();
  for (const st of windows.values()) {
    const chrome = st.chromeWebContents();
    if (chrome && chrome.id === id) return isTrustedChromeFileUrl(senderUrl);
  }
  return false;
}

function stateForEvent(event) {
  return stateFromContents(event.sender);
}

function stateFromContents(webContents) {
  for (const st of windows.values()) {
    const chrome = st.chromeWebContents();
    if (chrome && chrome.id === webContents.id) return st;
    for (const tab of st.tabs) {
      if (tab.view && tab.view.webContents.id === webContents.id) return st;
    }
  }
  return null;
}

function stateFromWebContentsId(id) {
  for (const st of windows.values()) {
    for (const tab of st.tabs) {
      if (tab.view && tab.view.webContents.id === id) return st;
    }
  }
  return null;
}

function activeTab(st) {
  return st.tabs.find((t) => t.id === st.activeTabId) || null;
}

function tabSnapshot(st) {
  const tab = activeTab(st);
  const summary = wallet.getSummary();
  return {
    tabs: st.tabs.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.id === st.activeTabId,
      private: st.isPrivate,
      tor: st.isTor,
    })),
    activeTabId: st.activeTabId,
    shieldsOn: tab ? shieldsForUrl(tab.url) : !!store.settings.globalShields,
    blockedCount: tab ? tab.blockedCount : 0,
    globalShields: !!store.settings.globalShields,
    httpsUpgrade: !!store.settings.httpsUpgrade,
    fingerprintResist: !!store.settings.fingerprintResist,
    showBookmarksBar: !!store.settings.showBookmarksBar && st.mode === 'normal',
    bookmarks: store.bookmarks.items,
    isBookmarked: tab && !isAnonUrl(tab.url) ? store.isBookmarked(tab.url) : false,
    isPrivate: st.isPrivate,
    isTor: st.isTor,
    mode: st.mode,
    torConnected: !!(torStatus && torStatus.ok),
    torHost: torStatus?.host || store.settings.torSocksHost,
    torPort: torStatus?.port || store.settings.torSocksPort,
    vaultBalance: summary.balanceFormatted,
    vaultLocked: summary.locked || !summary.created,
  };
}

function sendChrome(st, channel, payload) {
  const chrome = st.chromeWebContents();
  if (chrome && !chrome.isDestroyed()) {
    chrome.send(channel, payload);
  }
}

function sendContent(st, channel, payload) {
  if (st.activeView && !st.activeView.webContents.isDestroyed()) {
    st.activeView.webContents.send(channel, payload);
  }
}

function broadcast(st) {
  sendChrome(st, 'chrome:state', tabSnapshot(st));
}

function broadcastAll() {
  for (const st of windows.values()) broadcast(st);
}

function broadcastDownloads() {
  for (const st of windows.values()) {
    sendContent(st, 'downloads:changed', null);
  }
}

function layoutContent(st) {
  if (!st.win || st.win.isDestroyed()) return;
  const [w, h] = st.win.getContentSize();
  const top = st.chromeHeight();
  // Electron 43: BrowserWindow.webContents paints over contentView children.
  // Chrome and tabs must both be WebContentsViews under BaseWindow.contentView.
  if (st.chromeView) {
    st.chromeView.setBounds({ x: 0, y: 0, width: w, height: top });
  }
  if (st.activeView) {
    st.activeView.setBounds({
      x: 0,
      y: top,
      width: w,
      height: Math.max(0, h - top),
    });
  }
}

function destroyTabView(st, tab) {
  const view = tab?.view;
  if (!view) return;
  const contents = view.webContents;
  internalWebContents.delete(contents.id);
  if (st.activeView === view) st.activeView = null;
  if (!st.win.isDestroyed()) st.win.contentView.removeChildView(view);
  if (!contents.isDestroyed()) contents.close({ waitForBeforeUnload: false });
  tab.view = null;
}

function createTabView(st, tab, isInternal) {
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, isInternal ? 'preload-internal.js' : 'preload-content.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      plugins: true,
      session: sessionFor(st.mode),
      disableBlinkFeatures: isInternal ? undefined : 'CSSColorSchemeUARendering',
    },
  });
  view.setVisible(false);
  if (!isInternal) {
    view.setBackgroundColor('#ffffff');
  }
  st.win.contentView.addChildView(view);

  tab.view = view;
  tab.isInternal = isInternal;
  if (isInternal) internalWebContents.add(view.webContents.id);
  attachContentListeners(st, view, tab);
  return view;
}

/**
 * Internal pages have privileged preload APIs; web pages have an empty preload.
 * Replace the entire WebContentsView whenever a tab crosses that trust boundary.
 */
function ensureTabView(st, tab, isInternal) {
  if (tab.view && tab.isInternal === isInternal) return tab.view;
  const wasActive = st.activeTabId === tab.id;
  destroyTabView(st, tab);
  const view = createTabView(st, tab, isInternal);
  if (wasActive) switchToTabView(st, tab);
  return view;
}

function normalizeUrl(url, { tor = false } = {}) {
  if (!url) return HOME_URL;
  if (isAnonUrl(url)) return url;
  const onion = normalizeOnionInput(url);
  if (onion) return onion;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;
  if (url.includes(' ') || !url.includes('.')) {
    return searchUrl(url, { tor });
  }
  return `https://${url}`;
}

/**
 * Load content into a specific tab's view
 */
function loadTabContent(st, tab) {
  tab.blockedCount = 0;
  let target = tab.url;

  if (st.isTor && !isAnonUrl(target) && !(torStatus && torStatus.ok)) {
    target = 'anon://settings';
    tab.url = target;
    tab.title = 'Settings';
  }

  const view = ensureTabView(st, tab, isAnonUrl(target));
  if (isAnonUrl(target)) {
    view.webContents.loadFile(resolveAnonUrl(target));
    tab.title = anonTitle(target);
  } else {
    view.webContents.loadURL(target);
  }
  broadcast(st);
}

/**
 * Switch window to show a specific tab's view
 */
function switchToTabView(st, tab) {
  if (!tab.view) return;
  for (const candidate of st.tabs) {
    candidate.view?.setVisible(candidate === tab);
  }
  st.activeView = tab.view;
  // Re-adding an existing child moves it to the top of the native view stack.
  st.win.contentView.addChildView(tab.view);
  layoutContent(st);
  broadcast(st);
}

/**
 * Navigate the active tab to a URL
 */
function loadInContent(st, url) {
  const tab = activeTab(st);
  if (!tab) return;
  
  let target = normalizeUrl(url, { tor: st.isTor });

  // .onion outside Tor window → open Tor window instead
  if (!st.isTor && isOnionUrl(target)) {
    createBrowserWindow('tor', target);
    return;
  }

  tab.url = target;
  tab.blockedCount = 0;
  loadTabContent(st, tab);
}

function createTab(st, url = HOME_URL) {
  const id = `t${++st.tabSeq}`;
  const normalizedUrl = normalizeUrl(url, { tor: st.isTor });
  const tab = {
    id,
    url: normalizedUrl,
    title: isAnonUrl(normalizedUrl) ? anonTitle(normalizedUrl) : 'New Tab',
    view: null,
    isInternal: false,
    blockedCount: 0,
  };

  st.tabs.push(tab);
  st.activeTabId = id;
  loadTabContent(st, tab);
  switchToTabView(st, tab);
  return tab;
}

function closeTab(st, id) {
  const idx = st.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  
  const tab = st.tabs[idx];
  
  destroyTabView(st, tab);
  st.tabs.splice(idx, 1);
  
  if (st.tabs.length === 0) {
    if (st.mode !== 'normal') {
      st.win.close();
      return;
    }
    createTab(st, HOME_URL);
    return;
  }
  
  if (st.activeTabId === id) {
    const next = st.tabs[Math.max(0, idx - 1)];
    st.activeTabId = next.id;
    switchToTabView(st, next);
  } else {
    broadcast(st);
  }
}

function switchTab(st, id) {
  const tab = st.tabs.find((t) => t.id === id);
  if (!tab) return;
  st.activeTabId = id;
  switchToTabView(st, tab);
}

const WEB_PROTOCOLS = /^(https?|about|blob|data):/i;

function promptExternalProtocol(st, url) {
  const protocol = url.split(':', 1)[0] + ':';
  dialog
    .showMessageBox(st.win, {
      type: 'question',
      buttons: ['Open', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: `Open ${protocol} link in another app?`,
      detail: url.length > 200 ? url.slice(0, 200) + '…' : url,
    })
    .then(({ response }) => {
      if (response === 0) shell.openExternal(url);
    });
}

/**
 * Keep content pages on a light canvas. CDP debugger Emulation is intentionally
 * NOT used: under sandbox, webContents.debugger.attach() hangs and can stall
 * later insertCSS / navigation.
 */
/** Always-on CSS so dark window chrome cannot paint a dark UA canvas under pages. */
const LIGHT_PAGE_CSS = `
  html {
    color-scheme: only light !important;
    background-color: #ffffff !important;
  }
`;

/**
 * Inject light-scheme CSS + EasyList/site cosmetics when Shields are on.
 * @param {WindowState} st
 * @param {{ url: string, view: Electron.WebContentsView }} tab
 */
function injectCosmetics(st, tab) {
  const view = tab?.view;
  const wc = view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const url = tab.url;
  if (!url || isAnonUrl(url)) return;

  // Always force light page canvas (independent of Shields) — readability first.
  wc.insertCSS(LIGHT_PAGE_CSS).catch(() => {});

  if (!shieldsForUrl(url)) return;
  const css = `${cosmeticStylesForUrl(url)}\n${siteCosmeticCss(url)}`.trim();
  if (css) wc.insertCSS(css).catch(() => {});
  const script = siteCosmeticScript(url);
  if (script) wc.executeJavaScript(script, true).catch(() => {});
}

function attachContentListeners(st, view, tab) {
  const wc = view.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (!WEB_PROTOCOLS.test(url) && !isAnonUrl(url)) {
      promptExternalProtocol(st, url);
      return { action: 'deny' };
    }
    createTab(st, url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    const crossesTrustBoundary =
      (tab.isInternal && !isTrustedInternalFileUrl(url)) ||
      (!tab.isInternal && isAnonUrl(url));
    if (crossesTrustBoundary) {
      e.preventDefault();
      if (WEB_PROTOCOLS.test(url) || isAnonUrl(url)) {
        setImmediate(() => {
          if (st.tabs.includes(tab) && !st.win.isDestroyed()) {
            tab.url = url;
            loadTabContent(st, tab);
          }
        });
      } else if (!url.startsWith('file:')) {
        promptExternalProtocol(st, url);
      }
      return;
    }
    if (!tab.isInternal && url.startsWith('file:')) {
      e.preventDefault();
      return;
    }
    if (!WEB_PROTOCOLS.test(url) && !isAnonUrl(url)) {
      e.preventDefault();
      promptExternalProtocol(st, url);
    }
  });
  wc.on('page-title-updated', (_e, title) => {
    if (!tab) return;
    if (isAnonUrl(tab.url)) tab.title = anonTitle(tab.url);
    else tab.title = title || tab.url;
    broadcast(st);
  });
  wc.on('did-navigate', (_e, url) => {
    if (!tab) return;
    if (isAnonUrl(tab.url) && url.startsWith('file:')) {
      broadcast(st);
      return;
    }
    if (!url.startsWith('file:')) {
      tab.url = url;
      if (st.mode === 'normal') store.recordHistory(tab.title, url);
      broadcast(st);
      // Early light-scheme CSS (before paint finishes)
      if (!isAnonUrl(url)) wc.insertCSS(LIGHT_PAGE_CSS).catch(() => {});
    }
  });
  wc.on('did-navigate-in-page', (_e, url) => {
    if (!tab || isAnonUrl(tab.url)) return;
    if (!url.startsWith('file:')) {
      tab.url = url;
      broadcast(st);
    }
  });
  wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = aborted
    if (st.isTor && tab && !isAnonUrl(tab.url)) {
      // Likely Tor down mid-session
      refreshTorStatus().then(() => {
        if (!(torStatus && torStatus.ok)) {
          loadInContent(st, 'anon://settings');
        }
      });
    }
  });
  wc.on('dom-ready', () => injectCosmetics(st, tab));
  wc.on('did-finish-load', () => injectCosmetics(st, tab));
  wc.on('did-start-loading', () => {
    if (tab) tab.blockedCount = 0;
    sendChrome(st, 'chrome:loading', { loading: true });
  });
  wc.on('did-stop-loading', () => {
    sendChrome(st, 'chrome:loading', { loading: false });
    broadcast(st);
  });
  wc.on('found-in-page', (_e, result) => {
    sendChrome(st, 'chrome:find-result', {
      active: result.activeMatchOrdinal,
      total: result.matches,
    });
  });
}

async function refreshTorStatus() {
  torStatus = await detectTor({
    host: store.settings.torSocksHost,
    port: Number(store.settings.torSocksPort) || 9050,
  });
  const ses = sessionFor('tor');
  if (torStatus.ok) {
    await applyTorProxy(ses, { host: torStatus.host, port: torStatus.port });
  } else {
    await applyTorProxy(ses, null);
  }
  broadcastAll();
  return torStatus;
}

function setupSessionPrivacy(ses, mode = 'normal') {
  ses.anonFingerprintResist = !!store.settings.fingerprintResist;
  attachPrivacyToSession(ses, {
    resolve: (details) => {
      const st =
        details.webContentsId != null
          ? stateFromWebContentsId(details.webContentsId)
          : null;
      
      // Find the tab that owns this webContents
      let tab = null;
      if (st && details.webContentsId != null) {
        tab = st.tabs.find(t => t.view?.webContents.id === details.webContentsId);
      }
      
      const pageUrl = tab ? tab.url : '';
      return {
        pageUrl,
        shieldsOn: pageUrl ? shieldsForUrl(pageUrl) : !!store.settings.globalShields,
        onBlocked: () => {
          if (!tab) return;
          tab.blockedCount += 1;
          sendChrome(st, 'chrome:blocked', { count: tab.blockedCount });
        },
      };
    },
    httpsUpgrade: () => !!store.settings.httpsUpgrade,
  });
  attachDownloads(ses, {
    persist: mode === 'normal',
    onChange: (record, done) => {
      if (done && record.persist && record.state === 'completed') {
        store.addDownload(record);
      }
      broadcastDownloads();
    },
  });
}

/**
 * @param {'normal' | 'private' | 'tor'} mode
 * @param {string | null} startUrl
 * @returns {Promise<Electron.BaseWindow>}
 */
async function createBrowserWindow(mode = 'normal', startUrl = null) {
  if (mode === 'tor') {
    await refreshTorStatus();
  }

  const bg =
    mode === 'tor' ? '#0c1410' : mode === 'private' ? '#12101a' : '#0a0a0b';

  // BaseWindow + sibling WebContentsViews: BrowserWindow's own webContents
  // paints over contentView children on Electron 43, so pages never appear.
  const win = new BaseWindow({
    show: !IS_SMOKE_TEST,
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: bg,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
  });

  const chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-chrome.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  chromeView.setBackgroundColor(bg.length === 7 ? `${bg}ff` : bg);
  win.contentView.addChildView(chromeView);

  const st = new WindowState(win, mode);
  st.chromeView = chromeView;
  st.pendingUrl = startUrl;
  windows.set(win.id, st);

  const ses = sessionFor(mode);
  setupSessionPrivacy(ses, mode);
  if (mode === 'tor' && torStatus?.ok) {
    await applyTorProxy(ses, { host: torStatus.host, port: torStatus.port });
  }

  layoutContent(st);
  chromeView.webContents.loadFile(path.join(__dirname, '../renderer/chrome.html'));
  win.on('resize', () => layoutContent(st));
  win.on('closed', () => {
    // Do not call webContents.close() here — tearing down child views while the
    // BaseWindow is already closing deadlocks on Electron 43.
    windows.delete(win.id);
    for (const tab of st.tabs) {
      if (tab.view) {
        internalWebContents.delete(tab.view.webContents.id);
        tab.view = null;
      }
    }
    st.tabs = [];
    st.activeView = null;
    st.chromeView = null;
  });

  chromeView.webContents.on('did-finish-load', () => {
    st.chromeReady = true;
    layoutContent(st);
    if (st.tabs.length === 0) {
      let start = HOME_URL;
      if (st.pendingUrl) {
        start = st.pendingUrl;
        st.pendingUrl = null;
      } else if (mode === 'tor' && !(torStatus && torStatus.ok)) {
        start = 'anon://settings';
      } else if (mode === 'tor') {
        start = HOME_URL;
      }
      createTab(st, start);
    } else {
      broadcast(st);
    }
  });

  return win;
}

function focusedState() {
  const focused = BaseWindow.getFocusedWindow();
  if (focused && windows.has(focused.id)) return windows.get(focused.id);
  return windows.values().next().value || null;
}

// ---------------------------------------------------------------------------
// Shields panel (per-site popup)

let shieldsPanel = null;
let shieldsPanelSt = null;

function closeShieldsPanel() {
  if (shieldsPanel && !shieldsPanel.isDestroyed()) shieldsPanel.close();
  shieldsPanel = null;
  shieldsPanelSt = null;
}

function openShieldsPanel(st, rect) {
  closeShieldsPanel();
  const width = 300;
  const height = 208;
  const [wx, wy] = st.win.getPosition();
  const [cw] = st.win.getContentSize();
  const x = Math.round(wx + Math.min(Math.max(8, rect.x + rect.width - width), cw - width - 8));
  const y = Math.round(wy + rect.y + rect.height + 6);

  shieldsPanelSt = st;
  shieldsPanel = new BrowserWindow({
    x,
    y,
    width,
    height,
    parent: st.win,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#18181b',
    webPreferences: {
      preload: path.join(__dirname, 'preload-shields.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  shieldsPanel.loadFile(path.join(__dirname, '../renderer/shields-panel.html'));
  shieldsPanel.once('ready-to-show', () => shieldsPanel && shieldsPanel.show());
  shieldsPanel.on('blur', () => closeShieldsPanel());
  shieldsPanel.on('closed', () => {
    shieldsPanel = null;
    shieldsPanelSt = null;
  });
}

function shieldsPanelInfo() {
  const st = shieldsPanelSt;
  if (!st) return null;
  const tab = activeTab(st);
  const host = tab ? hostKey(tab.url) : '';
  return {
    host: host === 'anon' ? '' : host,
    internal: !tab || isAnonUrl(tab.url),
    siteOn: tab ? shieldsForUrl(tab.url) : false,
    globalOn: !!store.settings.globalShields,
    blocked: tab?.blockedCount || 0,
    engine: engineStatus(),
  };
}

// ---------------------------------------------------------------------------

function registerIpc() {
  // Chrome and trusted internal pages may navigate their own window.
  ipcMain.handle('nav:goto', (e, url) => {
    if (!isInternalSender(e)) return false;
    const st = stateForEvent(e);
    if (!st) return false;
    const target = String(url || HOME_URL);
    if (isChromeSender(e)) {
      loadInContent(st, target);
    } else {
      // Let ipcRenderer.invoke resolve before a trust-boundary navigation
      // closes and replaces the internal sender's WebContents.
      setImmediate(() => {
        if (!st.win.isDestroyed()) loadInContent(st, target);
      });
    }
    return true;
  });
  ipcMain.handle('nav:back', (e) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e) || stateFromContents(e.sender);
    if (st?.activeView?.webContents.navigationHistory.canGoBack())
      st.activeView.webContents.navigationHistory.goBack();
  });
  ipcMain.handle('nav:forward', (e) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    if (st?.activeView?.webContents.navigationHistory.canGoForward())
      st.activeView.webContents.navigationHistory.goForward();
  });
  ipcMain.handle('nav:reload', (e) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    st?.activeView?.webContents.reload();
  });
  ipcMain.handle('nav:home', (e) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    if (st) loadInContent(st, HOME_URL);
  });

  // Tabs - chrome UI only (tabs:state exposes URLs + vault balance!)
  ipcMain.handle('tabs:create', (e, url) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    if (st) createTab(st, url || HOME_URL);
  });
  ipcMain.handle('tabs:close', (e, id) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    if (st) closeTab(st, id);
  });
  ipcMain.handle('tabs:switch', (e, id) => {
    if (!isChromeSender(e)) return;
    const st = stateForEvent(e);
    if (st) switchTab(st, id);
  });
  ipcMain.handle('tabs:state', (e) => {
    if (!isChromeSender(e)) return null;
    const st = stateForEvent(e);
    return st ? tabSnapshot(st) : null;
  });

  // Window management - chrome UI only  
  ipcMain.handle('window:new', async (e) => {
    if (!isChromeSender(e)) return;
    await createBrowserWindow('normal');
  });
  ipcMain.handle('window:newPrivate', async (e) => {
    if (!isChromeSender(e)) return;
    await createBrowserWindow('private');
  });
  ipcMain.handle('window:newTor', async (e) => {
    if (!isChromeSender(e)) return;
    await createBrowserWindow('tor');
  });

  // Tor status - internal pages only
  ipcMain.handle('tor:status', async (e) => {
    if (!isInternalSender(e)) return null;
    return refreshTorStatus();
  });
  ipcMain.handle('tor:get', (e) => {
    if (!isInternalSender(e)) return null;
    return {
      ...(torStatus || {
        ok: false,
        host: store.settings.torSocksHost,
        port: store.settings.torSocksPort,
      }),
      settingsHost: store.settings.torSocksHost,
      settingsPort: store.settings.torSocksPort,
    };
  });
  ipcMain.handle('tor:setSocks', async (e, { host, port }) => {
    if (!isInternalSender(e)) return null;
    if (host) store.settings.torSocksHost = String(host);
    if (port) store.settings.torSocksPort = Number(port) || 9050;
    store.saveSettings();
    return refreshTorStatus();
  });

  // -- shields --------------------------------------------------------------

  ipcMain.handle('shields:panel', (e, rect) => {
    const st = stateForEvent(e);
    if (!st) return;
    if (shieldsPanel) {
      closeShieldsPanel();
      return;
    }
    openShieldsPanel(st, rect || { x: 0, y: 40, width: 0, height: 0 });
  });
  ipcMain.handle('shieldsPanel:info', () => shieldsPanelInfo());
  ipcMain.handle('shieldsPanel:setSite', (_e, on) => {
    const st = shieldsPanelSt;
    if (!st) return null;
    const tab = activeTab(st);
    if (!tab || isAnonUrl(tab.url)) return null;
    siteShields.set(hostKey(tab.url), !!on);
    st.activeView?.webContents.reload();
    broadcast(st);
    return shieldsPanelInfo();
  });
  ipcMain.handle('shieldsPanel:setGlobal', (_e, on) => {
    store.settings.globalShields = !!on;
    store.saveSettings();
    broadcastAll();
    return shieldsPanelInfo();
  });
  ipcMain.handle('shieldsPanel:close', () => closeShieldsPanel());

  ipcMain.handle('shields:setGlobal', (e, on) => {
    if (!isInternalSender(e)) return false;
    store.settings.globalShields = !!on;
    store.saveSettings();
    broadcastAll();
    return true;
  });

  // -- find in page ---------------------------------------------------------

  ipcMain.handle('find:visible', (e, visible) => {
    const st = stateForEvent(e);
    if (!st) return;
    st.findVisible = !!visible;
    layoutContent(st);
    if (!visible) st.activeView?.webContents.stopFindInPage('clearSelection');
  });
  ipcMain.handle('find:query', (e, { text, forward = true, findNext = false }) => {
    const st = stateForEvent(e);
    const wc = st?.activeView?.webContents;
    if (!wc) return;
    if (!text) {
      wc.stopFindInPage('clearSelection');
      sendChrome(st, 'chrome:find-result', { active: 0, total: 0 });
      return;
    }
    wc.findInPage(text, { forward, findNext });
  });

  // -- settings / data ------------------------------------------------------

  ipcMain.handle('settings:get', (e) => {
    if (!isInternalSender(e)) return {};
    return { ...store.settings };
  });
  ipcMain.handle('settings:set', (e, patch) => {
    if (!isInternalSender(e)) return { ...store.settings };
    Object.assign(store.settings, patch || {});
    store.saveSettings();
    for (const st of windows.values()) {
      const ses = sessionFor(st.mode);
      ses.anonFingerprintResist = !!store.settings.fingerprintResist;
      layoutContent(st);
      broadcast(st);
    }
    return { ...store.settings };
  });

  ipcMain.handle('bookmarks:list', (e) => {
    if (!isInternalSender(e)) return [];
    return store.bookmarks.items;
  });
  ipcMain.handle('bookmarks:toggle', (e) => {
    if (!isInternalSender(e)) return store.bookmarks.items;
    const st = stateForEvent(e);
    const tab = st ? activeTab(st) : null;
    if (!tab || isAnonUrl(tab.url)) return store.bookmarks.items;
    store.toggleBookmark(tab.title, tab.url);
    broadcastAll();
    return store.bookmarks.items;
  });
  ipcMain.handle('bookmarks:remove', (e, id) => {
    if (!isInternalSender(e)) return store.bookmarks.items;
    store.removeBookmark(id);
    broadcastAll();
    return store.bookmarks.items;
  });
  ipcMain.handle('bookmarks:add', (e, { title, url }) => {
    if (!isInternalSender(e)) return store.bookmarks.items;
    store.addBookmark(title, url);
    broadcastAll();
    return store.bookmarks.items;
  });

  ipcMain.handle('history:list', (e) => (isInternalSender(e) ? store.history.entries : []));
  ipcMain.handle('history:clear', (e) => {
    if (isInternalSender(e)) store.clearHistory();
    return [];
  });
  ipcMain.handle('data:clearBrowsing', async (e) => {
    if (!isInternalSender(e)) return false;
    store.clearBrowsingData();
    await sessionFor('normal').clearCache();
    await sessionFor('normal').clearStorageData();
    return true;
  });

  // -- downloads ------------------------------------------------------------

  ipcMain.handle('downloads:list', (e) => {
    if (!isInternalSender(e)) return [];
    const liveItems = listLive();
    const liveIds = new Set(liveItems.map((r) => r.id));
    return [
      ...liveItems,
      ...store.downloads.items.filter((r) => !liveIds.has(r.id)),
    ];
  });
  ipcMain.handle('downloads:cancel', (e, id) => {
    if (isInternalSender(e)) cancelDownload(id);
  });
  ipcMain.handle('downloads:open', (e, savePath) => {
    if (isInternalSender(e) && typeof savePath === 'string') shell.openPath(savePath);
  });
  ipcMain.handle('downloads:reveal', (e, savePath) => {
    if (isInternalSender(e) && typeof savePath === 'string')
      shell.showItemInFolder(savePath);
  });
  ipcMain.handle('downloads:clear', (e) => {
    if (isInternalSender(e)) store.clearDownloads();
    broadcastDownloads();
    return [];
  });

  // -- vault ----------------------------------------------------------------

  const guard = (e) => {
    if (!isInternalSender(e)) throw new Error('Not allowed');
  };
  const vaultCall = async (e, fn) => {
    try {
      guard(e);
      wallet.touch();
      const result = await fn();
      broadcastAll();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  ipcMain.handle('vault:state', (e) =>
    isInternalSender(e) ? wallet.getState() : { created: false, locked: true }
  );
  ipcMain.handle('vault:create', (e, pass) =>
    vaultCall(e, async () => {
      const mnemonic = await wallet.create(pass, store.settings.walletNetwork);
      return { mnemonic, state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:import', (e, { pass, secret }) =>
    vaultCall(e, async () => {
      await wallet.import(pass, secret, store.settings.walletNetwork);
      return { state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:unlock', (e, pass) =>
    vaultCall(e, async () => {
      await wallet.unlock(pass);
      return { state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:lock', (e) =>
    vaultCall(e, async () => {
      wallet.lock();
      return { state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:refresh', (e) =>
    vaultCall(e, async () => {
      await wallet.sync();
      return { state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:receive', (e) =>
    vaultCall(e, async () => {
      const r = await wallet.receive();
      return { receive: r };
    })
  );
  ipcMain.handle('vault:estimate', (e, { to, amount }) =>
    vaultCall(e, async () => {
      const coins = parseCoinInput(amount);
      if (coins === null || coins <= 0n) throw new Error('Enter an amount as ¢ or ₿ (e.g. ¢ 5,000 or ₿ 0.01)');
      const est = await wallet.estimateSend(to, coins);
      return {
        fee: est.fee.toString(),
        feeFormatted: formatCoin(est.fee),
        totalFormatted: formatCoin(coins + est.fee),
        rate: est.rate,
        inputs: est.inputs,
      };
    })
  );
  ipcMain.handle('vault:send', (e, { pass, to, amount }) =>
    vaultCall(e, async () => {
      const coins = parseCoinInput(amount);
      if (coins === null || coins <= 0n) throw new Error('Enter an amount as ¢ or ₿ (e.g. ¢ 5,000 or ₿ 0.01)');
      const res = await wallet.send(pass, to, coins);
      return { txid: res.txid, state: wallet.getState() };
    })
  );
  ipcMain.handle('vault:destroy', (e, pass) =>
    vaultCall(e, async () => {
      await wallet.destroy(pass);
      return { state: wallet.getState() };
    })
  );

  ipcMain.handle('shell:openExternal', (e, url) => {
    if (!isInternalSender(e)) return;
    if (typeof url === 'string' && /^https?:/i.test(url)) shell.openExternal(url);
  });
}

function zoomContent(delta) {
  const wc = focusedState()?.activeView?.webContents;
  if (!wc) return;
  wc.setZoomLevel(delta === 0 ? 0 : wc.getZoomLevel() + delta);
}

async function importBookmarksFlow() {
  const st = focusedState();
  if (!st) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(st.win, {
    title: 'Import Bookmarks',
    properties: ['openFile'],
    filters: [{ name: 'Bookmarks', extensions: ['html', 'htm', 'json'] }],
  });
  if (canceled || !filePaths[0]) return;
  try {
    const entries = parseBookmarksFile(filePaths[0]);
    let added = 0;
    for (const entry of entries) {
      if (!store.isBookmarked(entry.url)) {
        store.addBookmark(entry.title, entry.url);
        added += 1;
      }
    }
    broadcastAll();
    dialog.showMessageBox(st.win, {
      message: `Imported ${added} bookmark${added === 1 ? '' : 's'}`,
      detail: entries.length !== added ? `${entries.length - added} already existed.` : undefined,
    });
  } catch (err) {
    dialog.showMessageBox(st.win, {
      type: 'error',
      message: 'Import failed',
      detail: err.message,
    });
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const go = (url) => {
    const st = focusedState();
    if (st) loadInContent(st, url);
  };
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => go('anon://settings'),
              },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const st = focusedState();
            if (st) createTab(st, HOME_URL);
          },
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createBrowserWindow('normal'),
        },
        {
          label: 'New Private Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createBrowserWindow('private'),
        },
        {
          label: 'New Tor Window',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => createBrowserWindow('tor'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const st = focusedState();
            if (st?.activeTabId) closeTab(st, st.activeTabId);
          },
        },
        { type: 'separator' },
        {
          label: 'Vault',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => go('anon://vault'),
        },
        {
          label: 'Agent',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => go('anon://agent'),
        },
        {
          label: 'Downloads',
          accelerator: 'CmdOrCtrl+Shift+J',
          click: () => go('anon://downloads'),
        },
        { type: 'separator' },
        {
          label: 'Import Bookmarks…',
          click: () => importBookmarksFlow(),
        },
        ...(!isMac
          ? [
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => go('anon://settings'),
              },
            ]
          : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find…',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const st = focusedState();
            if (st) sendChrome(st, 'chrome:find-show', null);
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => focusedState()?.activeView?.webContents.reload(),
        },
        {
          label: 'Bookmark This Page',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            const st = focusedState();
            const tab = st ? activeTab(st) : null;
            if (!tab || isAnonUrl(tab.url)) return;
            store.toggleBookmark(tab.title, tab.url);
            broadcastAll();
          },
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => zoomContent(0),
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => zoomContent(0.5),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => zoomContent(-0.5),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => focusedState()?.chromeWebContents()?.toggleDevTools(),
        },
      ],
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Show All History',
          accelerator: 'CmdOrCtrl+Y',
          click: () => go('anon://history'),
        },
        {
          label: 'Clear History',
          click: () => {
            store.clearHistory();
          },
        },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        {
          label: 'Bookmark Manager',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => go('anon://bookmarks'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  app.setName('Anon Browser');
  // Keep websites in light color-scheme even when macOS / chrome UI is dark.
  nativeTheme.themeSource = 'light';
  nativeTheme.on('updated', () => {
    if (nativeTheme.themeSource !== 'light') nativeTheme.themeSource = 'light';
  });
  // Pre-masked squircle PNG (transparent corners) via dock.setIcon.
  if (process.platform === 'darwin' && app.dock) {
    const icon = nativeImage.createFromPath(APP_ICON);
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }
  store = new AppStore();
  await initFilterEngine(app.getPath('userData'));
  setupSessionPrivacy(sessionFor('normal'), 'normal');
  registerIpc();
  buildMenu();

  // Auto-lock the vault after inactivity
  setInterval(() => {
    if (wallet.maybeAutoLock()) broadcastAll();
  }, 60 * 1000);

  if (IS_SMOKE_TEST) {
    try {
      const { runElectronSmoke } = require('../test/electron-smoke');
      await runElectronSmoke({
        app,
        windows,
        createBrowserWindow,
        activeTab,
        createTab,
        closeTab,
        switchTab,
        loadInContent,
        sessionFor,
        wallet,
        smokeRoot: SMOKE_ROOT,
      });
    } catch (err) {
      console.error('Electron smoke failed:', err?.stack || err);
      process.exitCode = 1;
    } finally {
      app.quit();
    }
    return;
  }

  refreshTorStatus().finally(() => {
    createBrowserWindow('normal');
  });
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createBrowserWindow('normal');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
