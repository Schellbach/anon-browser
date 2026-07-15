(() => {
  const $ = (id) => document.getElementById(id);
  const panels = ['panel-setup', 'panel-backup', 'panel-lock', 'panel-wallet'];

  let lastState = null;

  function show(panelId) {
    for (const id of panels) $(id).hidden = id !== panelId;
    if (panelId !== 'panel-wallet') {
      $('panel-receive').hidden = true;
      $('panel-send').hidden = true;
      $('panel-history').hidden = true;
    }
  }

  function paintBadge(state) {
    const badge = $('badge');
    const parts = [];
    if (state.network === 'testnet') parts.push('testnet');
    if (state.watchOnly) parts.push('watch-only');
    badge.textContent = parts.join(' · ');
    badge.hidden = parts.length === 0;
  }

  function paintWallet(state) {
    show('panel-wallet');
    paintBadge(state);
    $('balance').textContent = state.balance?.formatted || '0 sats';

    const pending = $('pending-line');
    if (state.balance?.pendingFormatted) {
      pending.hidden = false;
      pending.textContent = `Pending: ${state.balance.pendingFormatted}`;
    } else {
      pending.hidden = true;
    }

    const sync = $('sync-line');
    if (state.syncError) sync.textContent = `Sync failed: ${state.syncError}`;
    else if (state.syncing || !state.synced) sync.textContent = 'Syncing…';
    else sync.textContent = '';

    $('btn-send-show').hidden = !!state.watchOnly;

    const historyPanel = $('panel-history');
    const list = $('history');
    list.innerHTML = '';
    for (const tx of state.txs || []) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = `${tx.direction === 'send' ? 'Sent' : 'Received'}${tx.confirmed ? '' : ' · pending'}`;
      const right = document.createElement('span');
      right.className = `amt ${tx.direction}`;
      right.textContent = `${tx.direction === 'send' ? '−' : '+'}${tx.formatted}`;
      li.append(left, right);
      li.title = tx.txid;
      list.appendChild(li);
    }
    historyPanel.hidden = (state.txs || []).length === 0;
  }

  async function refresh() {
    const state = await window.anonVault.state();
    lastState = state;
    if (!state.created) show('panel-setup');
    else if (state.locked) show('panel-lock');
    else paintWallet(state);
    if (state.created && state.locked) paintBadge(state);
  }

  // -- setup ----------------------------------------------------------------

  $('btn-show-import').addEventListener('click', () => {
    $('import-field').hidden = !$('import-field').hidden;
  });

  $('btn-create').addEventListener('click', async () => {
    $('setup-error').textContent = '';
    const res = await window.anonVault.create($('setup-pass').value);
    if (!res.ok) {
      $('setup-error').textContent = res.error;
      return;
    }
    $('setup-pass').value = '';
    $('mnemonic').textContent = res.mnemonic;
    show('panel-backup');
  });

  $('btn-backup-done').addEventListener('click', () => {
    $('mnemonic').textContent = '';
    refresh();
  });

  $('btn-import').addEventListener('click', async () => {
    $('setup-error').textContent = '';
    const res = await window.anonVault.import(
      $('setup-pass').value,
      $('import-secret').value
    );
    if (!res.ok) {
      $('setup-error').textContent = res.error;
      return;
    }
    $('setup-pass').value = '';
    $('import-secret').value = '';
    refresh();
  });

  // -- lock / unlock ----------------------------------------------------------

  $('btn-unlock').addEventListener('click', async () => {
    $('unlock-error').textContent = '';
    const res = await window.anonVault.unlock($('unlock-pass').value);
    if (!res.ok) {
      $('unlock-error').textContent = res.error;
      return;
    }
    $('unlock-pass').value = '';
    refresh();
  });
  $('unlock-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-unlock').click();
  });

  $('btn-lock').addEventListener('click', async () => {
    await window.anonVault.lock();
    refresh();
  });

  // -- wallet actions ---------------------------------------------------------

  $('btn-refresh').addEventListener('click', async () => {
    $('sync-line').textContent = 'Syncing…';
    await window.anonVault.refresh();
    refresh();
  });

  $('btn-receive').addEventListener('click', async () => {
    const res = await window.anonVault.receive();
    if (!res.ok) return;
    $('panel-send').hidden = true;
    $('panel-receive').hidden = false;
    $('qr').src = res.receive.qr;
    $('receive-address').textContent = res.receive.address;
    $('btn-copy-address').onclick = () =>
      navigator.clipboard.writeText(res.receive.address);
    $('btn-copy-uri').onclick = () => navigator.clipboard.writeText(res.receive.uri);
  });

  $('btn-send-show').addEventListener('click', () => {
    $('panel-receive').hidden = true;
    $('panel-send').hidden = !$('panel-send').hidden;
  });

  $('btn-estimate').addEventListener('click', async () => {
    $('send-error').textContent = '';
    $('fee-line').textContent = '';
    const res = await window.anonVault.estimate($('send-to').value, $('send-amount').value);
    if (!res.ok) {
      $('send-error').textContent = res.error;
      return;
    }
    $('fee-line').textContent =
      `Fee ${res.feeFormatted} (${res.rate} sat/vB) · total ${res.totalFormatted}`;
  });

  $('btn-send').addEventListener('click', async () => {
    $('send-error').textContent = '';
    const btn = $('btn-send');
    btn.disabled = true;
    try {
      const res = await window.anonVault.send(
        $('send-pass').value,
        $('send-to').value,
        $('send-amount').value
      );
      if (!res.ok) {
        $('send-error').textContent = res.error;
        return;
      }
      $('send-pass').value = '';
      $('send-amount').value = '';
      $('send-to').value = '';
      $('fee-line').textContent = '';
      const out = $('send-result');
      out.hidden = false;
      out.textContent = `Broadcast: ${res.txid}`;
      refresh();
    } finally {
      btn.disabled = false;
    }
  });

  // Periodic repaint while syncing
  setInterval(async () => {
    if (lastState && lastState.created && !lastState.locked) {
      const state = await window.anonVault.state();
      lastState = state;
      if (!state.locked) paintWallet(state);
      else refresh();
    }
  }, 5000);

  refresh();
})();
