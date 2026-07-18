/**
 * Supplemental first-party / partner promo hides that network filters miss.
 * Selectors are taken from live page HTML where possible.
 */

/** @type {Record<string, string>} hostname suffix -> CSS */
const SITE_CSS = {
  'zerohedge.com': `
    /* GPT / Prebid empty slots */
    .adv,
    .leaderboard,
    .leaderboard-tablet,
    .leaderboard-container,
    .leaderboard-tablet-container,
    #leaderboard,
    #leaderboard-tablet,
    #leaderboard-mobile,
    #left-one,
    #native-1,
    #native-2,
    .left-rail,
    .native.adv,
    [class*="PromoBanner"],
    iframe[id*="google_ads" i],
    iframe[src*="doubleclick" i],
    iframe[src*="googlesyndication" i],
    iframe[src*="amazon-adsystem" i],
    /* ZeroHedge Store sidebar */
    #store-promo,
    [class*="SidebarLeft_storePromo"],
    a[href*="store.zerohedge.com"],
    /* Monetary Metals widgets (first-party images) */
    [class*="MMWidget"],
    a[href*="monetary-metals.com"],
    a[href*="monetarymetals.com"],
    img[src*="monetary_metals"],
    img[srcset*="monetary_metals"],
    /* Polymarket embeds (often client-injected) */
    iframe[src*="polymarket"],
    [class*="polymarket" i],
    [id*="polymarket" i],
    a[href*="polymarket.com"]
    {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      max-height: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `,
};

/** JS that keeps re-hiding client-injected promos (ZeroHedge SPA widgets). */
const ZH_HIDE_SCRIPT = `(() => {
  if (window.__anonZhHide) return;
  window.__anonZhHide = true;
  const SEL = [
    '.adv', '#leaderboard', '#leaderboard-tablet', '#leaderboard-mobile',
    '#left-one', '#native-1', '#native-2', '#store-promo',
    '[class*="SidebarLeft_storePromo"]', '[class*="MMWidget"]',
    '[class*="PromoBanner"]', 'iframe[src*="polymarket"]',
    '[class*="polymarket" i]', '[id*="polymarket" i]',
    'a[href*="monetary-metals.com"]', 'a[href*="store.zerohedge.com"]',
    'img[src*="monetary_metals"]'
  ].join(',');
  const hide = () => {
    try {
      document.querySelectorAll(SEL).forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('hidden', '');
      });
    } catch (_) {}
  };
  hide();
  new MutationObserver(hide).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();`;

/**
 * @param {string} pageUrl
 * @returns {string}
 */
function siteCosmeticCss(pageUrl) {
  if (!pageUrl || !/^https?:/i.test(pageUrl)) return '';
  let host;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
  for (const [suffix, css] of Object.entries(SITE_CSS)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return css;
  }
  return '';
}

/**
 * @param {string} pageUrl
 * @returns {string | null} script source or null
 */
function siteCosmeticScript(pageUrl) {
  if (!pageUrl || !/^https?:/i.test(pageUrl)) return null;
  let host;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
  if (host === 'zerohedge.com' || host.endsWith('.zerohedge.com')) return ZH_HIDE_SCRIPT;
  return null;
}

module.exports = { siteCosmeticCss, siteCosmeticScript };
