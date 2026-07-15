/** Bitcoin amounts as integer sats. Display as sats or BTC. */

const SATS_PER_BTC = 100_000_000n;

/**
 * @param {bigint | number | string} sats
 * @returns {string}
 */
function formatCoin(sats) {
  const n = typeof sats === 'bigint' ? sats : BigInt(sats);
  if (n < 0n) return `−${formatCoin(-n)}`;
  if (n >= SATS_PER_BTC) {
    const whole = n / SATS_PER_BTC;
    const frac = n % SATS_PER_BTC;
    if (frac === 0n) return `${whole.toLocaleString('en-US')} BTC`;
    const dec = frac.toString().padStart(8, '0').replace(/0+$/, '');
    return `${whole.toLocaleString('en-US')}.${dec} BTC`;
  }
  return `${n.toLocaleString('en-US')} sats`;
}

/**
 * Parse user input like "5000", "5000 sats", "0.01 BTC", "₿ 1.5" into sats.
 * Legacy ¢ (1 coin = 1 sat) is still accepted.
 * @param {string} input
 * @returns {bigint | null}
 */
function parseCoinInput(input) {
  const raw = String(input).trim().replace(/,/g, '');
  if (!raw) return null;
  if (/^₿/.test(raw) || /btc/i.test(raw)) {
    const num = raw
      .replace(/^₿\s*/i, '')
      .replace(/\s*btc\s*/i, '')
      .trim();
    const f = Number(num);
    if (!Number.isFinite(f) || f < 0) return null;
    return BigInt(Math.round(f * Number(SATS_PER_BTC)));
  }
  const digits = raw
    .replace(/^¢\s*/i, '')
    .replace(/\s*sats?\s*/i, '')
    .replace(/coins?/i, '')
    .trim();
  if (!/^\d+$/.test(digits)) return null;
  return BigInt(digits);
}

/**
 * BIP21 amount= is BTC decimals.
 * @param {bigint} sats
 * @returns {string}
 */
function coinsToBip21Amount(sats) {
  const whole = sats / SATS_PER_BTC;
  const frac = sats % SATS_PER_BTC;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(8, '0').replace(/0+$/, '')}`;
}

module.exports = {
  COIN_PER_BTC: SATS_PER_BTC, // alias for callers
  SATS_PER_BTC,
  formatCoin,
  parseCoinInput,
  coinsToBip21Amount,
};
