(() => {
  const hostEl = document.getElementById('host');
  const blockedEl = document.getElementById('blocked');
  const siteSwitch = document.getElementById('switch-site');
  const globalSwitch = document.getElementById('switch-global');
  const engineLine = document.getElementById('engine-line');

  function paint(info) {
    if (!info) return;
    hostEl.textContent = info.internal ? 'Internal page' : info.host || '—';
    blockedEl.textContent = String(info.blocked || 0);
    siteSwitch.classList.toggle('on', !!info.siteOn);
    siteSwitch.disabled = info.internal;
    globalSwitch.classList.toggle('on', !!info.globalOn);
    engineLine.textContent =
      info.engine === 'ready'
        ? 'Full filter lists active'
        : info.engine === 'fallback'
          ? 'Compact blocklist (lists unavailable)'
          : 'Loading filter lists…';
  }

  siteSwitch.addEventListener('click', async () => {
    paint(await window.shieldsPanel.setSite(!siteSwitch.classList.contains('on')));
  });
  globalSwitch.addEventListener('click', async () => {
    paint(await window.shieldsPanel.setGlobal(!globalSwitch.classList.contains('on')));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.shieldsPanel.close();
  });

  window.shieldsPanel.info().then(paint);
})();
