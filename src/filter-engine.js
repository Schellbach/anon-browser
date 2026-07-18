/**
 * EasyList-class network filtering via Ghostery's adblocker engine
 * (same filter syntax family as uBlock Origin / Brave Shields).
 *
 * The engine is loaded from a local cache instantly and refreshed from the
 * prebuilt ads+tracking engine in the background (weekly). If the network
 * is unavailable and no cache exists, callers fall back to the compact
 * host blocklist in privacy/blocklist.js.
 */
const fs = require('fs');
const path = require('path');

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** Electron resourceType -> adblocker request type */
const TYPE_MAP = {
  mainFrame: 'main_frame',
  subFrame: 'sub_frame',
  stylesheet: 'stylesheet',
  script: 'script',
  image: 'image',
  font: 'font',
  object: 'object',
  xhr: 'xmlhttprequest',
  ping: 'ping',
  cspReport: 'csp_report',
  media: 'media',
  webSocket: 'websocket',
};

let engine = null;
let Request = null;
let status = 'loading'; // 'loading' | 'ready' | 'fallback'
let cacheDir = null;

function binPath() {
  return path.join(cacheDir, 'adblock-engine.bin');
}

function metaPath() {
  return path.join(cacheDir, 'adblock-engine.json');
}

async function refresh(adblocker) {
  const fresh = await adblocker.FiltersEngine.fromPrebuiltAdsAndTracking(fetch);
  engine = fresh;
  status = 'ready';
  try {
    fs.writeFileSync(binPath(), Buffer.from(fresh.serialize()));
    fs.writeFileSync(metaPath(), JSON.stringify({ fetchedAt: Date.now() }));
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * @param {string} dir userData directory for the engine cache
 */
async function initFilterEngine(dir) {
  cacheDir = dir;
  const adblocker = await import('@ghostery/adblocker');
  Request = adblocker.Request;

  try {
    engine = adblocker.FiltersEngine.deserialize(new Uint8Array(fs.readFileSync(binPath())));
    status = 'ready';
  } catch {
    engine = null;
  }

  let fetchedAt = 0;
  try {
    fetchedAt = JSON.parse(fs.readFileSync(metaPath(), 'utf8')).fetchedAt || 0;
  } catch {
    fetchedAt = 0;
  }

  if (!engine || Date.now() - fetchedAt > REFRESH_MS) {
    refresh(adblocker).catch(() => {
      if (!engine) status = 'fallback';
    });
  }
}

/**
 * @param {{ url: string, resourceType: string, referrer?: string }} details
 * @returns {boolean} whether the request should be blocked
 */
function engineMatch(details) {
  if (!engine || !Request) return false;
  try {
    const req = Request.fromRawDetails({
      url: details.url,
      type: TYPE_MAP[details.resourceType] || 'other',
      sourceUrl: details.referrer || '',
    });
    return !!engine.match(req).match;
  } catch {
    return false;
  }
}

function engineStatus() {
  return status;
}

/**
 * Cosmetic (element-hiding) styles for a page URL.
 * @param {string} pageUrl
 * @returns {string} CSS to insert, or ''
 */
function cosmeticStylesForUrl(pageUrl) {
  if (!engine || !pageUrl || !/^https?:/i.test(pageUrl)) return '';
  try {
    const { hostname } = new URL(pageUrl);
    const { getDomain } = require('tldts-experimental');
    const domain = getDomain(hostname) || hostname;
    const { styles } = engine.getCosmeticsFilters({
      url: pageUrl,
      hostname,
      domain,
      getBaseRules: true,
      getInjectionRules: false,
      getExtendedRules: false,
      getRulesFromDOM: false,
      getRulesFromHostname: true,
    });
    return styles || '';
  } catch {
    return '';
  }
}

module.exports = { initFilterEngine, engineMatch, engineStatus, cosmeticStylesForUrl };
