(() => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');

  function fmt(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '';
    }
  }

  async function render() {
    const entries = await window.anonNav.listHistory();
    list.innerHTML = '';
    empty.hidden = entries.length > 0;
    for (const e of entries) {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML =
        '<div><div class="list-title"></div><div class="list-url"></div></div><div class="list-meta"></div>';
      row.querySelector('.list-title').textContent = e.title || e.url;
      row.querySelector('.list-url').textContent = e.url;
      row.querySelector('.list-meta').textContent = fmt(e.at);
      row.addEventListener('click', () => window.anonNav.goto(e.url));
      list.appendChild(row);
    }
  }

  document.getElementById('btn-clear').addEventListener('click', async () => {
    await window.anonNav.clearHistory();
    render();
  });

  render();
})();
