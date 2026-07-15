(() => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.anonNav.goto(q);
  });
})();
