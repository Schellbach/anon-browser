// Web content preload - MINIMAL for security.
// Web pages (https/http/onion) must NOT get vault/settings/bookmarks/history/Tor APIs.
//
// Early readability: dark app chrome can otherwise leave a dark UA canvas under
// light sites (black text on black). Applied only after DOM exists so a preload
// throw cannot blank navigation.

function applyLightCanvas() {
  try {
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty('color-scheme', 'only light', 'important');
    root.style.setProperty('background-color', '#ffffff', 'important');
  } catch {
    /* ignore */
  }
}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLightCanvas, { once: true });
  } else {
    applyLightCanvas();
  }
} catch {
  /* Preload must never throw — it would blank every web page. */
}
