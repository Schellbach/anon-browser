(() => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');

  async function render() {
    const items = await window.anonNav.listBookmarks();
    list.innerHTML = '';
    empty.hidden = items.length > 0;
    for (const b of items) {
      const row = document.createElement('div');
      row.className = 'list-row';
      const left = document.createElement('div');
      left.innerHTML = '<div class="list-title"></div><div class="list-url"></div>';
      left.querySelector('.list-title').textContent = b.title;
      left.querySelector('.list-url').textContent = b.url;
      left.addEventListener('click', () => window.anonNav.goto(b.url));

      const remove = document.createElement('button');
      remove.className = 'btn';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.anonNav.removeBookmark(b.id);
        render();
      });

      row.append(left, remove);
      list.appendChild(row);
    }
  }

  render();
})();
