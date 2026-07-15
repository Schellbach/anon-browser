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
 * 
 * Security: Uses bigint-only arithmetic. No IEEE floats. Rejects over-precision
 * (>8 decimals for BTC) rather than silently rounding.
 * 
 * @param {string} input
 * @returns {bigint | null}
 */
function parseCoinInput(input) {
  const raw = String(input).trim().replace(/,/g, '');
  if (!raw) return null;
  
  // BTC amount (₿ or btc suffix)
  if (/^₿/.test(raw) || /btc/i.test(raw)) {
    const num = raw
      .replace(/^₿\s*/i, '')
      .replace(/\s*btc\s*/i, '')
      .trim();
    
    // Parse as decimal string without float conversion
    const parts = num.split('.');
    if (parts.length > 2) return null; // multiple decimal points
    
    const wholePart = parts[0] || '0';
    const fracPart = parts[1] || '';
    
    // Validate: only digits
    if (!/^\d+$/.test(wholePart)) return null;
    if (fracPart && !/^\d+$/.test(fracPart)) return null;
    
    // Reject over-precision (>8 decimal places)
    if (fracPart.length > 8) return null;
    
    // Convert to sats using bigint arithmetic
    // BTC whole part → sats
    const wholeSats = BigInt(wholePart) * SATS_PER_BTC;
    
    // BTC fractional part → sats (pad to 8 decimals)
    const fracPadded = fracPart.padEnd(8, '0');
    const fracSats = BigInt(fracPadded);
    
    const total = wholeSats + fracSats;
    if (total < 0n) return null;
    
    return total;
  }
  
  // Sats amount (plain number or with sats/coins suffix)
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
