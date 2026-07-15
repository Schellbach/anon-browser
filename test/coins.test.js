const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseCoinInput, formatCoin, coinsToBip21Amount, SATS_PER_BTC } = require('../vault/coins');

describe('vault/coins.js - parseCoinInput', () => {
  it('parses plain sats', () => {
    assert.strictEqual(parseCoinInput('1'), 1n);
    assert.strictEqual(parseCoinInput('1000'), 1000n);
    assert.strictEqual(parseCoinInput('100000000'), 100000000n);
  });

  it('parses sats with "sats" suffix', () => {
    assert.strictEqual(parseCoinInput('5000 sats'), 5000n);
    assert.strictEqual(parseCoinInput('5000 sat'), 5000n);
  });

  it('parses BTC amounts', () => {
    assert.strictEqual(parseCoinInput('₿ 1'), SATS_PER_BTC);
    assert.strictEqual(parseCoinInput('1 BTC'), SATS_PER_BTC);
    assert.strictEqual(parseCoinInput('0.5 btc'), 50000000n);
    assert.strictEqual(parseCoinInput('₿ 0.00000001'), 1n);
  });

  it('parses BTC with up to 8 decimal places', () => {
    assert.strictEqual(parseCoinInput('₿ 1.00000001'), 100000001n);
    assert.strictEqual(parseCoinInput('1.12345678 BTC'), 112345678n);
  });

  it('rejects over-precision (>8 decimals)', () => {
    assert.strictEqual(parseCoinInput('₿ 1.000000001'), null);
    assert.strictEqual(parseCoinInput('0.123456789 BTC'), null);
  });

  it('handles large values', () => {
    assert.strictEqual(parseCoinInput('₿ 21000000'), 21000000n * SATS_PER_BTC);
  });

  it('rejects invalid inputs', () => {
    assert.strictEqual(parseCoinInput(''), null);
    assert.strictEqual(parseCoinInput('abc'), null);
    assert.strictEqual(parseCoinInput('-100'), null);
    assert.strictEqual(parseCoinInput('₿ -1'), null);
    assert.strictEqual(parseCoinInput('1.2.3'), null);
  });

  it('handles commas', () => {
    assert.strictEqual(parseCoinInput('1,000'), 1000n);
    assert.strictEqual(parseCoinInput('1,000,000'), 1000000n);
  });

  it('handles legacy ¢ coin prefix', () => {
    assert.strictEqual(parseCoinInput('¢ 100'), 100n);
  });
});

describe('vault/coins.js - formatCoin', () => {
  it('formats small amounts as sats', () => {
    assert.strictEqual(formatCoin(1n), '1 sats');
    assert.strictEqual(formatCoin(1000n), '1,000 sats');
    assert.strictEqual(formatCoin(50000000n), '50,000,000 sats');
  });

  it('formats whole BTC amounts', () => {
    assert.strictEqual(formatCoin(100000000n), '1 BTC');
    assert.strictEqual(formatCoin(200000000n), '2 BTC');
  });

  it('formats fractional BTC amounts', () => {
    assert.strictEqual(formatCoin(100000001n), '1.00000001 BTC');
    assert.strictEqual(formatCoin(150000000n), '1.5 BTC');
    assert.strictEqual(formatCoin(112345678n), '1.12345678 BTC');
  });

  it('handles negative amounts', () => {
    assert.strictEqual(formatCoin(-1000n), '−1,000 sats');
  });
});

describe('vault/coins.js - coinsToBip21Amount', () => {
  it('formats BIP21 amounts correctly', () => {
    assert.strictEqual(coinsToBip21Amount(100000000n), '1');
    assert.strictEqual(coinsToBip21Amount(50000000n), '0.5');
    assert.strictEqual(coinsToBip21Amount(1n), '0.00000001');
    assert.strictEqual(coinsToBip21Amount(112345678n), '1.12345678');
  });
});
