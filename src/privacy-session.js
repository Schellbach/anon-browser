const { session } = require('electron');
const { shouldBlockUrl, isBadwareUrl } = require('../privacy/blocklist');
const { engineMatch } = require('./filter-engine');
const { isOnionUrl } = require('./tor');

const wired = new WeakSet();

/**
 * Attach shields + HTTPS upgrade + privacy headers to a session (once).
 * @param {Electron.Session} ses
 * @param {{
 *   resolve: (details: Electron.OnBeforeRequestListenerDetails) =>
 *     { pageUrl: string, shieldsOn: boolean, onBlocked: () => void },
 *   httpsUpgrade: () => boolean,
 * }} opts
 */
function attachPrivacyToSession(ses, opts) {
  if (wired.has(ses)) return;
  wired.add(ses);

  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const { shieldsOn, onBlocked } = opts.resolve(details);

    // Scareware / forced-redirect hosts: block even main-frame navigations
    if (shieldsOn && isBadwareUrl(details.url)) {
      onBlocked();
      callback({ cancel: true });
      return;
    }

    if (details.resourceType === 'mainFrame') {
      // HTTPS upgrade — skip .onion (often HTTP-only) and localhost
      if (
        opts.httpsUpgrade() &&
        details.url.startsWith('http://') &&
        !details.url.startsWith('http://localhost') &&
        !details.url.startsWith('http://127.0.0.1') &&
        !isOnionUrl(details.url)
      ) {
        callback({ redirectURL: details.url.replace(/^http:\/\//i, 'https://') });
        return;
      }
      callback({});
      return;
    }

    if (!shieldsOn) {
      callback({});
      return;
    }

    // EasyList-class engine first, compact host blocklist as fallback/extra
    if (engineMatch(details) || shouldBlockUrl(details.url)) {
      onBlocked();
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (ses.anonFingerprintResist) {
      delete headers['Sec-CH-UA'];
      delete headers['Sec-CH-UA-Mobile'];
      delete headers['Sec-CH-UA-Platform'];
      delete headers['Sec-CH-UA-Full-Version-List'];
      headers.DNT = '1';
      headers['Sec-GPC'] = '1';
    }
    callback({ requestHeaders: headers });
  });

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    const deny = new Set([
      'media',
      'geolocation',
      'notifications',
      'midi',
      'pointerLock',
      'openExternal',
    ]);
    callback(!deny.has(permission));
  });
}

/**
 * @param {'normal' | 'private' | 'tor'} mode
 * @returns {Electron.Session}
 */
function sessionFor(mode) {
  if (mode === 'tor') {
    return session.fromPartition('persist:anon-tor', { cache: false });
  }
  if (mode === 'private') {
    return session.fromPartition('anon-private', { cache: false });
  }
  return session.defaultSession;
}

/**
 * Route a Tor session through local SOCKS5 (Tor daemon / Tor Browser).
 * @param {Electron.Session} ses
 * @param {{ host: string, port: number } | null} proxy
 */
async function applyTorProxy(ses, proxy) {
  if (!proxy) {
    await ses.setProxy({ mode: 'direct' });
    ses.anonTorProxy = null;
    return;
  }
  await ses.setProxy({
    proxyRules: `socks5://${proxy.host}:${proxy.port}`,
    proxyBypassRules: '<local>',
  });
  ses.anonTorProxy = proxy;
}

module.exports = { attachPrivacyToSession, sessionFor, applyTorProxy };
