const net = require('net');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9050;
const ALT_PORTS = [9050, 9150]; // tor daemon · Tor Browser

/**
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function probeSocks(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * @param {{ host?: string, port?: number }} [opts]
 * @returns {Promise<{ ok: boolean, host: string, port: number, checked: number[] }>}
 */
async function detectTor(opts = {}) {
  const host = opts.host || DEFAULT_HOST;
  const preferred = opts.port || DEFAULT_PORT;
  const checked = [];
  const ports = [preferred, ...ALT_PORTS.filter((p) => p !== preferred)];
  for (const port of ports) {
    checked.push(port);
    if (await probeSocks(host, port)) {
      return { ok: true, host, port, checked };
    }
  }
  return { ok: false, host, port: preferred, checked };
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isOnionUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.onion');
  } catch {
    return /\.onion(\/|$)/i.test(String(url || ''));
  }
}

/**
 * Bare v3 onion address or onion URL → http(s) URL.
 * @param {string} input
 * @returns {string | null}
 */
function normalizeOnionInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return isOnionUrl(raw) ? raw : null;
  }
  // v3 onion: 56 chars base32 + .onion
  const bare = raw.replace(/\/$/, '');
  if (/^[a-z2-7]{56}\.onion$/i.test(bare)) {
    return `http://${bare.toLowerCase()}`;
  }
  if (/^[a-z2-7]{16}\.onion$/i.test(bare)) {
    return `http://${bare.toLowerCase()}`;
  }
  if (bare.toLowerCase().endsWith('.onion') && !bare.includes(' ')) {
    return `http://${bare.toLowerCase()}`;
  }
  return null;
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  detectTor,
  probeSocks,
  isOnionUrl,
  normalizeOnionInput,
};
