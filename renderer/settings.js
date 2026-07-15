(() => {
  const switches = {
    globalShields: document.getElementById('switch-shields'),
    httpsUpgrade: document.getElementById('switch-https'),
    fingerprintResist: document.getElementById('switch-fp'),
    showBookmarksBar: document.getElementById('switch-bookmarks'),
  };
  const torHost = document.getElementById('tor-host');
  const torPort = document.getElementById('tor-port');
  const torStatusLine = document.getElementById('tor-status-line');

  const walletNetwork = document.getElementById('wallet-network');

  function paint(settings) {
    for (const [key, el] of Object.entries(switches)) {
      const on = !!settings[key];
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (settings.torSocksHost) torHost.value = settings.torSocksHost;
    if (settings.torSocksPort) torPort.value = String(settings.torSocksPort);
    walletNetwork.value = settings.walletNetwork || 'mainnet';
  }

  async function syncTor() {
    const t = await window.anonNav.torGet();
    torHost.value = t.settingsHost || t.host || '127.0.0.1';
    torPort.value = String(t.settingsPort || t.port || 9050);
    torStatusLine.textContent = t.ok ? `${t.host}:${t.port}` : `unreachable · ${t.host}:${t.port}`;
    document.getElementById('tor-hint').hidden = !!t.ok;
  }

  async function sync() {
    paint(await window.anonNav.getSettings());
    await syncTor();
  }

  for (const [key, el] of Object.entries(switches)) {
    el.addEventListener('click', async () => {
      paint(await window.anonNav.setSettings({ [key]: !el.classList.contains('on') }));
    });
  }

  document.getElementById('btn-tor-save').addEventListener('click', async () => {
    await window.anonNav.torSetSocks(torHost.value.trim(), Number(torPort.value));
    await syncTor();
  });

  walletNetwork.addEventListener('change', async () => {
    paint(await window.anonNav.setSettings({ walletNetwork: walletNetwork.value }));
  });

  document.getElementById('btn-clear').addEventListener('click', async () => {
    const msg = document.getElementById('clear-msg');
    await window.anonNav.clearBrowsingData();
    msg.textContent = 'Cleared';
    setTimeout(() => {
      msg.textContent = '';
    }, 1500);
  });

  sync();
})();
