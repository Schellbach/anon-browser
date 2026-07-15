(() => {
  const form = document.getElementById('agent-form');
  const prompt = document.getElementById('prompt');
  const status = document.getElementById('status');
  const out = document.getElementById('out');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = prompt.value.trim();
    if (!text) return;
    status.textContent = 'No agent runtime';
    out.hidden = false;
    out.textContent =
      'Agent plane is not wired in this build.\nKeys stay in Vault — agents never hold them.';
  });
})();
