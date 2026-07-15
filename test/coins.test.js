const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  parseCoinInput,
  formatCoin,
  coinsToBip21Amount,
  COIN_PER_BTC,
  SATS_PER_BTC,
} = require('../vault/coins');

describe('vault/coins.js - parseCoinInput', () => {
  it('parses plain coins', () => {
    assert.strictEqual(parseCoinInput('1'), 1n);
    assert.strictEqual(parseCoinInput('1000'), 1000n);
    assert.strictEqual(parseCoinInput('100000000'), 100000000n);
  });

  it('parses Coin Standard ¢ prefix', () => {
    assert.strictEqual(parseCoinInput('¢ 100'), 100n);
    assert.strictEqual(parseCoinInput('¢ 5,433'), 5433n);
    assert.strictEqual(parseCoinInput('¢5433'), 5433n);
  });

  it('parses ¢ million shorthand', () => {
    assert.strictEqual(parseCoinInput('¢ 50m'), 50_000_000n);
    assert.strictEqual(parseCoinInput('¢ 100m'), COIN_PER_BTC);
    assert.strictEqual(parseCoinInput('100m'), 100_000_000n);
  });

  it('parses legacy sats suffix', () => {
    assert.strictEqual(parseCoinInput('5000 sats'), 5000n);
    assert.strictEqual(parseCoinInput('5000 sat'), 5000n);
  });

  it('parses ₿ amounts', () => {
    assert.strictEqual(parseCoinInput('₿ 1'), COIN_PER_BTC);
    assert.strictEqual(parseCoinInput('1 BTC'), COIN_PER_BTC);
    assert.strictEqual(parseCoinInput('0.5 btc'), 50_000_000n);
    assert.strictEqual(parseCoinInput('₿ 0.00000001'), 1n);
  });

  it('parses ₿ with up to 8 decimal places', () => {
    assert.strictEqual(parseCoinInput('₿ 1.00000001'), 100000001n);
    assert.strictEqual(parseCoinInput('1.12345678 BTC'), 112345678n);
  });

  it('rejects over-precision (>8 decimals)', () => {
    assert.strictEqual(parseCoinInput('₿ 1.000000001'), null);
    assert.strictEqual(parseCoinInput('0.123456789 BTC'), null);
  });

  it('handles large values', () => {
    assert.strictEqual(parseCoinInput('₿ 21000000'), 21000000n * COIN_PER_BTC);
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

  it('keeps SATS_PER_BTC alias', () => {
    assert.strictEqual(SATS_PER_BTC, COIN_PER_BTC);
  });
});

describe('vault/coins.js - formatCoin (Coin Standard)', () => {
  it('formats small amounts as ¢', () => {
    assert.strictEqual(formatCoin(0n), '¢ 0');
    assert.strictEqual(formatCoin(1n), '¢ 1');
    assert.strictEqual(formatCoin(1000n), '¢ 1,000');
    assert.strictEqual(formatCoin(5433n), '¢ 5,433');
  });

  it('formats exact millions as ¢ Nm', () => {
    assert.strictEqual(formatCoin(1_000_000n), '¢ 1m');
    assert.strictEqual(formatCoin(50_000_000n), '¢ 50m');
  });

  it('formats whole bitcoin as ₿', () => {
    assert.strictEqual(formatCoin(100000000n), '₿ 1');
    assert.strictEqual(formatCoin(200000000n), '₿ 2');
  });

  it('formats fractional bitcoin as ₿', () => {
    assert.strictEqual(formatCoin(100000001n), '₿ 1.00000001');
    assert.strictEqual(formatCoin(150000000n), '₿ 1.5');
    assert.strictEqual(formatCoin(112345678n), '₿ 1.12345678');
  });

  it('handles negative amounts', () => {
    assert.strictEqual(formatCoin(-1000n), '−¢ 1,000');
    assert.strictEqual(formatCoin(-COIN_PER_BTC), '−₿ 1');
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
