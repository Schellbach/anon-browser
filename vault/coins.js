/**
 * Coin Standard amounts: integer coins on-chain (1 coin = 1 satoshi).
 * Display: ¢ for coins, ₿ for whole/decimal bitcoin — symbol before the number.
 * @see https://coinsymbol.wtf/skill.md
 */

const COIN_PER_BTC = 100_000_000n;
/** @deprecated use COIN_PER_BTC */
const SATS_PER_BTC = COIN_PER_BTC;

/**
 * Format coins for UI per Coin Standard.
 * @param {bigint | number | string} coins
 * @returns {string} e.g. `¢ 5,433`, `¢ 50m`, `₿ 1`, `₿ 0.5`
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

  // Exact millions ≥ ¢ 1m → shorthand (¢ 100m = ₿ 1)
  if (n >= 1_000_000n && n % 1_000_000n === 0n) {
    return `¢ ${(n / 1_000_000n).toLocaleString('en-US')}m`;
  }

  return `¢ ${n.toLocaleString('en-US')}`;
}

/**
 * Parse user input into integer coins.
 * Accepts Coin Standard (`¢ 5,433`, `₿ 0.5`, `¢ 50m`) and legacy
 * (`5000 sats`, `0.01 BTC`) for paste/compat.
 *
 * Security: bigint-only arithmetic. No IEEE floats. Rejects over-precision
 * (>8 decimals for ₿/BTC) rather than silently rounding.
 *
 * @param {string} input
 * @returns {bigint | null}
 */
function parseCoinInput(input) {
  const raw = String(input).trim().replace(/,/g, '');
  if (!raw) return null;

  // Bitcoin major unit (₿ or btc)
  if (/^₿/.test(raw) || /btc/i.test(raw)) {
    const num = raw
      .replace(/^₿\s*/i, '')
      .replace(/\s*btc\s*/i, '')
      .trim();

    const parts = num.split('.');
    if (parts.length > 2) return null;

    const wholePart = parts[0] || '0';
    const fracPart = parts[1] || '';

    if (!/^\d+$/.test(wholePart)) return null;
    if (fracPart && !/^\d+$/.test(fracPart)) return null;
    if (fracPart.length > 8) return null;

    const wholeCoins = BigInt(wholePart) * COIN_PER_BTC;
    const fracCoins = BigInt(fracPart.padEnd(8, '0'));
    return wholeCoins + fracCoins;
  }

  // Coins: ¢ prefix, sats/coins suffix, or plain integer; optional `m` millions
  let digits = raw
    .replace(/^¢\s*/i, '')
    .replace(/\s*sats?\s*/i, '')
    .replace(/\s*coins?\s*/i, '')
    .trim();

  const million = /^(\d+)m$/i.exec(digits);
  if (million) {
    return BigInt(million[1]) * 1_000_000n;
  }

  if (!/^\d+$/.test(digits)) return null;
  return BigInt(digits);
}

/**
 * BIP21 amount= is decimal BTC (wire format unchanged).
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
  SATS_PER_BTC,
  formatCoin,
  parseCoinInput,
  coinsToBip21Amount,
};
