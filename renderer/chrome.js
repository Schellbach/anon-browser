(() => {
  const tabsEl = document.getElementById('tabs');
  const omnibox = document.getElementById('omnibox');
  const omniboxForm = document.getElementById('omnibox-form');
  const omniboxWrap = omniboxForm;
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnShields = document.getElementById('btn-shields');
  const shieldsLabel = document.getElementById('shields-label');
  const btnVault = document.getElementById('btn-vault');
  const btnAgent = document.getElementById('btn-agent');
  const btnStar = document.getElementById('btn-star');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const chromeRoot = document.getElementById('chrome');
  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');

  let state = {
    tabs: [],
    shieldsOn: true,
    blockedCount: 0,
    bookmarks: [],
    showBookmarksBar: true,
    isPrivate: false,
    isTor: false,
    isBookmarked: false,
  };

  function displayUrl(url) {
    if (!url) return '';
    if (url.startsWith('anon://') || (url.startsWith('file:') && url.includes('.html'))) {
      return '';
    }
    return url;
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const tab of state.tabs) {
      const el = document.createElement('button');
      el.className = `tab${tab.active ? ' active' : ''}`;
      el.type = 'button';
      el.title = tab.title || tab.url;

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || 'New Tab';

      const close = document.createElement('span');
      close.className = 'tab-close';
      close.textContent = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        window.anon.closeTab(tab.id);
      });

      el.append(title, close);
      el.addEventListener('click', () => window.anon.switchTab(tab.id));
      tabsEl.appendChild(el);
    }

    const neu = document.createElement('button');
    neu.className = 'tab-new';
    neu.type = 'button';
    neu.title = 'New Tab';
    neu.textContent = '+';
    neu.addEventListener('click', () => window.anon.createTab());
    tabsEl.appendChild(neu);
  }

  function renderBookmarks() {
    const show = !!state.showBookmarksBar && !state.isPrivate && !state.isTor;
    bookmarksBar.hidden = !show;
    chromeRoot.classList.toggle('with-bookmarks', show);
    chromeRoot.classList.toggle('is-private', !!state.isPrivate && !state.isTor);
    chromeRoot.classList.toggle('is-tor', !!state.isTor);
    if (!show) return;

    bookmarksBar.innerHTML = '';
    for (const b of state.bookmarks || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bookmark-chip';
      btn.textContent = b.title;
      btn.title = b.url;
      btn.addEventListener('click', () => window.anon.goto(b.url));
      bookmarksBar.appendChild(btn);
    }
  }

  function renderChrome() {
    renderTabs();
    renderBookmarks();
    const active = state.tabs.find((t) => t.active);
    if (active && document.activeElement !== omnibox) {
      omnibox.value = displayUrl(active.url);
    }

    const on = !!state.shieldsOn;
    btnShields.classList.toggle('off', !on);
    shieldsLabel.textContent = on ? String(state.blockedCount || 0) : 'Off';
    btnShields.title = on ? `Shields (${state.blockedCount || 0})` : 'Shields off';

    btnStar.classList.toggle('on', !!state.isBookmarked);
    const canStar = active && active.url && !active.url.startsWith('anon://') && !state.isTor;
    btnStar.disabled = !canStar;
    btnStar.hidden = !canStar;
  }

  function applyState(next) {
    if (!next) return;
    state = next;
    renderChrome();
  }

  omniboxForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = omnibox.value.trim();
    if (!q) return;
    window.anon.goto(q);
  });

  btnBack.addEventListener('click', () => window.anon.back());
  btnForward.addEventListener('click', () => window.anon.forward());
  btnReload.addEventListener('click', () => window.anon.reload());
  btnShields.addEventListener('click', () => {
    const r = btnShields.getBoundingClientRect();
    window.anon.openShieldsPanel({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  });
  btnVault.addEventListener('click', () => window.anon.goto('anon://vault'));
  btnAgent.addEventListener('click', () => window.anon.goto('anon://agent'));
  btnStar.addEventListener('click', () => window.anon.toggleBookmark());
  omnibox.addEventListener('focus', () => omnibox.select());

  // Find in page
  function showFind() {
    findBar.hidden = false;
    chromeRoot.classList.add('with-find');
    window.anon.findVisible(true);
    findInput.focus();
    findInput.select();
  }
  function hideFind() {
    findBar.hidden = true;
    chromeRoot.classList.remove('with-find');
    findCount.textContent = '';
    window.anon.findVisible(false);
  }
  findInput.addEventListener('input', () => {
    window.anon.findQuery({ text: findInput.value, findNext: false });
  });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.anon.findQuery({
        text: findInput.value,
        forward: !e.shiftKey,
        findNext: true,
      });
    } else if (e.key === 'Escape') {
      hideFind();
    }
  });
  document.getElementById('find-prev').addEventListener('click', () => {
    window.anon.findQuery({ text: findInput.value, forward: false, findNext: true });
  });
  document.getElementById('find-next').addEventListener('click', () => {
    window.anon.findQuery({ text: findInput.value, forward: true, findNext: true });
  });
  document.getElementById('find-close').addEventListener('click', hideFind);

  window.anon.onFindShow(showFind);
  window.anon.onFindResult(({ active, total }) => {
    findCount.textContent = total ? `${active}/${total}` : findInput.value ? '0/0' : '';
  });

  window.anon.onState(applyState);
  window.anon.onBlocked(({ count }) => {
    state.blockedCount = count;
    renderChrome();
  });
  window.anon.onLoading(({ loading }) => {
    omniboxWrap.classList.toggle('loading', !!loading);
  });

  window.anon.getState().then(applyState);
})();
