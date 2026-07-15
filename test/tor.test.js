const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isOnionUrl, normalizeOnionInput } = require('../src/tor');

describe('src/tor.js - isOnionUrl', () => {
  it('detects v3 onion URLs', () => {
    assert.strictEqual(isOnionUrl('http://thehiddenwiki6aqqj3lz55kbfoxpqvb6pzw4jb5gvpvdqbpqxxxxxxxxxxx.onion'), true);
    assert.strictEqual(isOnionUrl('https://example1234567890abcdefghijklmnopqrstuvwxyz234567.onion/path'), true);
  });

  it('detects v2 onion URLs', () => {
    assert.strictEqual(isOnionUrl('http://3g2upl4pq6kufc4m.onion'), true);
    assert.strictEqual(isOnionUrl('https://expyuzz4wqqyqhjn.onion/'), true);
  });

  it('detects bare onion addresses without protocol', () => {
    assert.strictEqual(isOnionUrl('example1234567890abcdefghijklmnopqrstuvwxyz234567.onion'), true);
    assert.strictEqual(isOnionUrl('3g2upl4pq6kufc4m.onion/path'), true);
  });

  it('does not match non-onion URLs', () => {
    assert.strictEqual(isOnionUrl('https://example.com'), false);
    assert.strictEqual(isOnionUrl('https://example.com/onion'), false);
    assert.strictEqual(isOnionUrl('http://localhost'), false);
  });

  it('handles invalid inputs', () => {
    assert.strictEqual(isOnionUrl(''), false);
    assert.strictEqual(isOnionUrl('not a url'), false);
  });
});

describe('src/tor.js - normalizeOnionInput', () => {
  it('normalizes v3 onion addresses', () => {
    const v3 = 'thehiddenwiki6aqqj3lz55kbfoxpqvb6pzw4jb5gvpvdqbpqxxxxx';
    assert.strictEqual(
      normalizeOnionInput(v3 + '.onion'),
      'http://' + v3.toLowerCase() + '.onion'
    );
  });

  it('normalizes v2 onion addresses', () => {
    assert.strictEqual(
      normalizeOnionInput('3g2upl4pq6kufc4m.onion'),
      'http://3g2upl4pq6kufc4m.onion'
    );
  });

  it('preserves existing http(s) protocol', () => {
    const url = 'https://example1234567890abcdefghijklmnopqrstuvwxyz234567.onion/';
    assert.strictEqual(normalizeOnionInput(url), url);
  });

  it('lowercases addresses', () => {
    assert.strictEqual(
      normalizeOnionInput('EXAMPLE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567.ONION'),
      'http://example1234567890abcdefghijklmnopqrstuvwxyz234567.onion'
    );
  });

  it('strips trailing slash from bare addresses', () => {
    assert.strictEqual(
      normalizeOnionInput('3g2upl4pq6kufc4m.onion/'),
      'http://3g2upl4pq6kufc4m.onion'
    );
  });

  it('returns null for non-onion inputs', () => {
    assert.strictEqual(normalizeOnionInput('example.com'), null);
    assert.strictEqual(normalizeOnionInput('https://example.com'), null);
    assert.strictEqual(normalizeOnionInput(''), null);
  });

  it('handles other .onion addresses', () => {
    // Non-standard length but ends with .onion
    const result = normalizeOnionInput('custom.onion');
    assert.strictEqual(result, 'http://custom.onion');
  });
});
