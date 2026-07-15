const { describe, it } = require('node:test');
const assert = require('node:assert');
const { shouldBlockUrl, isBadwareUrl } = require('../privacy/blocklist');

describe('privacy/blocklist.js - shouldBlockUrl', () => {
  it('blocks known tracker hosts', () => {
    assert.strictEqual(shouldBlockUrl('https://doubleclick.net/ad'), true);
    assert.strictEqual(shouldBlockUrl('https://google-analytics.com/collect'), true);
    assert.strictEqual(shouldBlockUrl('https://connect.facebook.net/en_US/sdk.js'), true);
  });

  it('blocks tracker subdomains', () => {
    assert.strictEqual(shouldBlockUrl('https://pagead2.googlesyndication.com/ads'), true);
    assert.strictEqual(shouldBlockUrl('https://www.google-analytics.com/analytics.js'), true);
  });

  it('blocks URLs with path hints', () => {
    assert.strictEqual(shouldBlockUrl('https://example.com/ads?id=123'), true);
    assert.strictEqual(shouldBlockUrl('https://example.com/pixel/track'), true);
    assert.strictEqual(shouldBlockUrl('https://example.com/collect?v=1'), true);
  });

  it('does not block legitimate first-party sites', () => {
    // These were removed from the blocklist to preserve usability
    assert.strictEqual(shouldBlockUrl('https://facebook.com/'), false);
    assert.strictEqual(shouldBlockUrl('https://tiktok.com/'), false);
    assert.strictEqual(shouldBlockUrl('https://pinterest.com/pin/123'), false);
    assert.strictEqual(shouldBlockUrl('https://disqus.com/'), false);
    assert.strictEqual(shouldBlockUrl('https://gravatar.com/avatar/123'), false);
  });

  it('does not block normal sites', () => {
    assert.strictEqual(shouldBlockUrl('https://example.com/'), false);
    assert.strictEqual(shouldBlockUrl('https://news.ycombinator.com/'), false);
    assert.strictEqual(shouldBlockUrl('https://github.com/user/repo'), false);
  });

  it('handles non-http(s) protocols', () => {
    assert.strictEqual(shouldBlockUrl('file:///path/to/file'), false);
    assert.strictEqual(shouldBlockUrl('about:blank'), false);
  });
});

describe('privacy/blocklist.js - isBadwareUrl', () => {
  it('blocks known scareware hosts', () => {
    assert.strictEqual(isBadwareUrl('https://mackeeper.com/scan'), true);
    assert.strictEqual(isBadwareUrl('https://reimageplus.com/'), true);
    assert.strictEqual(isBadwareUrl('https://virus-alert.info/warning'), true);
  });

  it('blocks malicious ad networks', () => {
    assert.strictEqual(isBadwareUrl('https://clickadu.com/'), true);
    assert.strictEqual(isBadwareUrl('https://popads.net/'), true);
    assert.strictEqual(isBadwareUrl('https://propellerads.com/'), true);
  });

  it('does not block legitimate sites', () => {
    assert.strictEqual(isBadwareUrl('https://example.com/'), false);
    assert.strictEqual(isBadwareUrl('https://github.com/'), false);
  });
});
