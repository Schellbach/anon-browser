/** Coin Standard — ₿ 1 = ¢ 100,000,000. Display only; 1 coin = 1 sat on-chain. */

const COIN_PER_BTC = 100_000_000n;

/**
 * @param {bigint | number | string} coins
 * @returns {string}
 */
function formatCoin(coins) {
  const n = typeof coins === 'bigint' ? coins : BigInt(coins);
  if (n < 0n) return `−${formatCoin(-n)}`;
  if (n >= COIN_PER_BTC) {
    const whole = n / COIN_PER_BTC;
    const frac = n % COIN_PER_BTC;
    if (frac === 0n) return `₿ ${whole.toLocaleString('en-US')}`;
    const dec = frac.toString().padStart(8, '0').replace(/0+$/, '');
    return `₿ ${whole.toLocaleString('en-US')}.${dec}`;
  }
  return `¢ ${n.toLocaleString('en-US')}`;
}

/**
 * Parse user input like "5000", "¢ 5,000", "₿ 1.5" into integer coins.
 * @param {string} input
 * @returns {bigint | null}
 */
function parseCoinInput(input) {
  const raw = String(input).trim().replace(/,/g, '');
  if (!raw) return null;
  if (/^₿/.test(raw) || /^btc/i.test(raw)) {
    const num = raw.replace(/^₿\s*/i, '').replace(/^btc\s*/i, '');
    const f = Number(num);
    if (!Number.isFinite(f) || f < 0) return null;
    return BigInt(Math.round(f * Number(COIN_PER_BTC)));
  }
  const digits = raw.replace(/^¢\s*/i, '').replace(/coins?/i, '').trim();
  if (!/^\d+$/.test(digits)) return null;
  return BigInt(digits);
}

/**
 * BIP21 amount= is still BTC decimals.
 * @param {bigint} coins
 * @returns {string}
 */
function coinsToBip21Amount(coins) {
  const whole = coins / COIN_PER_BTC;
  const frac = coins % COIN_PER_BTC;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(8, '0').replace(/0+$/, '')}`;
}

module.exports = {
  COIN_PER_BTC,
  formatCoin,
  parseCoinInput,
  coinsToBip21Amount,
};
