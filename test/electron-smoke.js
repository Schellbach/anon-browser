const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { safeStorage } = require('electron');

const TIMEOUT_MS = 15_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeoutMs = TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await delay(25);
  }
  throw new Error(`Timed out: ${message}`);
}

async function waitForTab(st) {
  return waitFor(() => {
    const tab = st.tabs.find((item) => item.id === st.activeTabId);
    if (!tab?.view || tab.view.webContents.isLoadingMainFrame()) return null;
    return tab;
  }, `active tab in ${st.mode} window`);
}

async function startServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, headers: { ...req.headers } });
    if (req.url === '/download') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="electron-43-smoke.txt"',
      });
      res.end('electron 43 download ok\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
      <html>
        <head><title>Electron 43 smoke</title></head>
        <body style="height: 2400px">
          <input id="state" value="">
          <p id="path">${req.url}</p>
        </body>
      </html>`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function rendererSecuritySnapshot(contents) {
  return contents.executeJavaScript(`({
    userAgent: navigator.userAgent,
    brands: navigator.userAgentData?.brands || [],
    vault: typeof window.anonVault,
    nav: typeof window.anonNav,
    downloads: typeof window.anonDownloads
  })`);
}

async function assertRendered(win, contents, label) {
  // Avoid webContents.capturePage() here: on BaseWindow it can block the main
  // process when no display surface is ready (hangs the whole smoke suite).
  const snapshot = await contents.executeJavaScript(`({
    title: document.title || '',
    htmlLen: document.documentElement ? document.documentElement.outerHTML.length : 0,
    hasBody: !!document.body,
    href: location.href,
  })`);
  assert.equal(snapshot.hasBody, true, `${label} should have a document body`);
  assert.ok(snapshot.htmlLen > 100, `${label} should have HTML content (${snapshot.href})`);
  void win; // window layout is exercised via WebContentsView bounds elsewhere
}

async function runElectronSmoke(api) {
  const {
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
    smokeRoot,
  } = api;

  assert.equal(process.versions.electron, '43.1.1');
  assert.match(process.versions.chrome, /^150\./);
  assert.doesNotMatch(app.userAgentFallback, /Electron/i);
  assert.match(app.userAgentFallback, /Chrome\/150\.0\.0\.0/);
  assert.match(
    app.commandLine.getSwitchValue('disable-features'),
    /WebContentsForceDark/
  );

  const server = await startServer();
  const originalSync = wallet.sync;
  const originalEncryptionAvailable = safeStorage.isEncryptionAvailable;
  wallet.sync = async () => {};
  // Do not trigger a macOS Keychain authorization dialog in unattended CI.
  // Production still exercises safeStorage; this smoke validates the complete
  // fallback encryption, derivation, IPC, lock/unlock, and receive flow.
  safeStorage.isEncryptionAvailable = () => false;
  assert.equal(safeStorage.isEncryptionAvailable(), false);

  try {
    console.log('smoke: create normal window');
    const win = await createBrowserWindow('normal');
    const st = windows.get(win.id);
    assert.ok(st);

    let tab = await waitForTab(st);
    console.log('smoke: first tab ready', tab.url);
    assert.equal(tab.isInternal, true);
    assert.equal(tab.view.getVisible(), true);
    assert.ok(st.chromeView, 'chrome WebContentsView should exist');
    assert.ok(win.contentView.children.includes(st.chromeView));
    assert.ok(win.contentView.children.includes(tab.view));
    const internalContents = tab.view.webContents;
    const internalSnapshot = await rendererSecuritySnapshot(internalContents);
    assert.equal(internalSnapshot.vault, 'object');
    assert.equal(internalSnapshot.nav, 'object');
    assert.equal(internalSnapshot.downloads, 'object');
    await assertRendered(win, internalContents, 'internal page');

    loadInContent(st, `${server.baseUrl}/first`);
    tab = await waitFor(() => {
      const current = activeTab(st);
      if (
        !current?.view ||
        current.isInternal ||
        current.view.webContents.id === internalContents.id ||
        current.view.webContents.isLoadingMainFrame()
      ) {
        return null;
      }
      return current;
    }, 'internal-to-web trust-boundary navigation');
    await waitFor(() => internalContents.isDestroyed(), 'old internal WebContents cleanup');

    const firstTab = tab;
    const firstContents = tab.view.webContents;
    const webSnapshot = await rendererSecuritySnapshot(firstContents);
    assert.equal(webSnapshot.vault, 'undefined');
    assert.equal(webSnapshot.nav, 'undefined');
    assert.equal(webSnapshot.downloads, 'undefined');
    assert.equal(webSnapshot.userAgent, app.userAgentFallback);
    assert.doesNotMatch(webSnapshot.userAgent, /Electron/i);
    assert.equal(
      webSnapshot.brands.some((brand) => /electron/i.test(brand.brand)),
      false
    );
    await assertRendered(win, firstContents, 'web page');

    const firstRequest = await waitFor(
      () => server.requests.find((request) => request.url === '/first'),
      'first HTTP request'
    );
    assert.equal(firstRequest.headers['user-agent'], webSnapshot.userAgent);
    assert.equal(firstRequest.headers.dnt, '1');
    assert.equal(firstRequest.headers['sec-gpc'], '1');
    assert.equal(
      Object.keys(firstRequest.headers).some((name) => name.startsWith('sec-ch-ua')),
      false
    );

    await firstContents.executeJavaScript(
      `document.querySelector('#state').value = 'first-tab-state'; scrollTo(0, 700)`
    );
    const secondTab = createTab(st, `${server.baseUrl}/second`);
    await waitFor(() => {
      if (secondTab.view?.webContents.isLoadingMainFrame()) return false;
      return secondTab.view;
    }, 'second tab load');
    const secondContents = secondTab.view.webContents;
    await secondContents.executeJavaScript(
      `document.querySelector('#state').value = 'second-tab-state'`
    );

    switchTab(st, firstTab.id);
    assert.equal(firstTab.view.getVisible(), true);
    assert.equal(secondTab.view.getVisible(), false);
    assert.equal(
      await firstContents.executeJavaScript(`document.querySelector('#state').value`),
      'first-tab-state'
    );
    assert.ok(
      (await firstContents.executeJavaScript('scrollY')) > 0,
      'tab scroll position should survive switching'
    );

    switchTab(st, secondTab.id);
    assert.equal(
      await secondContents.executeJavaScript(`document.querySelector('#state').value`),
      'second-tab-state'
    );
    closeTab(st, secondTab.id);
    await waitFor(() => secondContents.isDestroyed(), 'closed tab WebContents cleanup');
    assert.equal(activeTab(st).id, firstTab.id);

    const normalSession = sessionFor('normal');
    const downloadDone = new Promise((resolve, reject) => {
      normalSession.once('will-download', (_event, item) => {
        item.once('done', (_doneEvent, state) => {
          if (state === 'completed') resolve(item.getSavePath());
          else reject(new Error(`Download ended with state ${state}`));
        });
      });
    });
    firstContents.downloadURL(`${server.baseUrl}/download`);
    const downloadedPath = await Promise.race([
      downloadDone,
      delay(TIMEOUT_MS).then(() => {
        throw new Error('Timed out: download');
      }),
    ]);
    assert.equal(path.dirname(downloadedPath), path.join(smokeRoot, 'downloads'));
    assert.equal(fs.readFileSync(downloadedPath, 'utf8'), 'electron 43 download ok\n');

    loadInContent(st, 'anon://vault');
    tab = await waitFor(() => {
      const current = activeTab(st);
      if (
        !current?.isInternal ||
        !current.view ||
        current.view.webContents.id === firstContents.id ||
        current.view.webContents.isLoadingMainFrame()
      ) {
        return null;
      }
      return current;
    }, 'web-to-internal trust-boundary navigation');
    await waitFor(() => firstContents.isDestroyed(), 'old web WebContents cleanup');
    const vaultContents = tab.view.webContents;
    const vaultSnapshot = await rendererSecuritySnapshot(vaultContents);
    assert.equal(vaultSnapshot.vault, 'object');

    await vaultContents.executeJavaScript(
      `window.anonNav.setSettings({ walletNetwork: 'testnet' })`
    );
    const created = await vaultContents.executeJavaScript(
      `window.anonVault.create('electron-43-smoke-passphrase')`
    );
    assert.equal(created.ok, true, created.error);
    assert.match(created.mnemonic, /^(?:[a-z]+ ){11}[a-z]+$/);
    const receive = await vaultContents.executeJavaScript(`window.anonVault.receive()`);
    assert.equal(receive.ok, true, receive.error);
    assert.match(receive.receive.address, /^tb1q/);
    assert.equal(
      (await vaultContents.executeJavaScript(`window.anonVault.lock()`)).ok,
      true
    );
    const wrongUnlock = await vaultContents.executeJavaScript(
      `window.anonVault.unlock('wrong-passphrase')`
    );
    assert.equal(wrongUnlock.ok, false);
    assert.equal(
      (
        await vaultContents.executeJavaScript(
          `window.anonVault.unlock('electron-43-smoke-passphrase')`
        )
      ).ok,
      true
    );
    assert.equal(
      (
        await vaultContents.executeJavaScript(
          `window.anonVault.destroy('electron-43-smoke-passphrase')`
        )
      ).ok,
      true
    );

    const privateWin = await createBrowserWindow('private', `${server.baseUrl}/private`);
    const privateState = windows.get(privateWin.id);
    await waitForTab(privateState);
    const privateSession = sessionFor('private');
    assert.equal(privateState.isPrivate, true);
    assert.equal(privateSession.isPersistent(), false);
    assert.equal(privateSession.storagePath, null);
    assert.notEqual(privateSession, normalSession);

    await normalSession.cookies.set({
      url: server.baseUrl,
      name: 'normal-only',
      value: '1',
    });
    assert.equal(
      (await privateSession.cookies.get({ url: server.baseUrl, name: 'normal-only' }))
        .length,
      0
    );

    const torWin = await createBrowserWindow('tor');
    const torState = windows.get(torWin.id);
    await waitForTab(torState);
    const torSession = sessionFor('tor');
    assert.equal(torState.isPrivate, true);
    assert.equal(torState.isTor, true);
    assert.equal(torSession.isPersistent(), false);
    assert.equal(torSession.storagePath, null);
    assert.notEqual(torSession, normalSession);
    assert.notEqual(torSession, privateSession);

    for (const state of [...windows.values()]) {
      if (!state.win.isDestroyed()) state.win.close();
    }
    try {
      await waitFor(() => windows.size === 0, 'window cleanup', 5_000);
    } catch {
      for (const id of [...windows.keys()]) windows.delete(id);
    }
  } finally {
    wallet.sync = originalSync;
    safeStorage.isEncryptionAvailable = originalEncryptionAvailable;
    await server.close();
  }

  console.log(
    `Electron smoke passed: Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`
  );
}

module.exports = { runElectronSmoke };
