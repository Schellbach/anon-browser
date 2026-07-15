/** Omnibox / new-tab search. UI always says "Search" — no provider branding. */

const DEFAULT_SEARCH = (q) =>
  `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`;

const TOR_SEARCH = (q) =>
  `http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/?q=${encodeURIComponent(q)}`;

/**
 * @param {string} query
 * @param {{ tor?: boolean }} [opts]
 */
function searchUrl(query, opts = {}) {
  return opts.tor ? TOR_SEARCH(query) : DEFAULT_SEARCH(query);
}

module.exports = { searchUrl };
