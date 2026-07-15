(() => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');

  function fmtBytes(n) {
    if (!n) return '';
    if (n > 1e9) return `${(n / 1e9).toFixed(1)} GB`;
    if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    if (n > 1e3) return `${(n / 1e3).toFixed(0)} KB`;
    return `${n} B`;
  }

  async function render() {
    const items = await window.anonDownloads.list();
    list.innerHTML = '';
    empty.hidden = items.length > 0;

    for (const d of items) {
      const row = document.createElement('div');
      row.className = 'list-row';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'list-title';
      title.textContent = d.filename;
      const meta = document.createElement('div');
      meta.className = 'list-url';
      if (d.state === 'progressing') {
        meta.textContent = `${fmtBytes(d.receivedBytes)} / ${fmtBytes(d.totalBytes)}`;
      } else {
        meta.textContent = `${d.state === 'completed' ? fmtBytes(d.totalBytes) : d.state} · ${d.url || ''}`.slice(0, 120);
      }
      left.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'row';
      if (d.state === 'progressing') {
        const cancel = document.createElement('button');
        cancel.className = 'btn';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => window.anonDownloads.cancel(d.id));
        actions.append(cancel);
      } else if (d.state === 'completed') {
        const open = document.createElement('button');
        open.className = 'btn';
        open.textContent = 'Open';
        open.addEventListener('click', () => window.anonDownloads.open(d.savePath));
        const reveal = document.createElement('button');
        reveal.className = 'btn';
        reveal.textContent = 'Show';
        reveal.addEventListener('click', () => window.anonDownloads.reveal(d.savePath));
        actions.append(open, reveal);
      }

      row.append(left, actions);
      list.appendChild(row);
    }
  }

  document.getElementById('btn-clear').addEventListener('click', async () => {
    await window.anonDownloads.clear();
    render();
  });

  window.anonDownloads.onChanged(render);
  render();
})();
