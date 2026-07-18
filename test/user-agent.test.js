const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildChromiumUserAgent } = require('../src/user-agent');

describe('Chromium user-agent normalization', () => {
  it('uses the reduced Chrome shape without exposing Electron', () => {
    const userAgent = buildChromiumUserAgent({
      chromeVersion: '150.0.7871.114',
      platform: 'darwin',
    });
    assert.equal(
      userAgent,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/150.0.0.0 Safari/537.36'
    );
    assert.doesNotMatch(userAgent, /Electron/i);
    assert.doesNotMatch(userAgent, /7871/);
  });

  it('emits mainstream reduced platform tokens', () => {
    assert.match(
      buildChromiumUserAgent({ chromeVersion: '150.1.2.3', platform: 'win32' }),
      /\(Windows NT 10\.0; Win64; x64\)/
    );
    assert.match(
      buildChromiumUserAgent({ chromeVersion: '150.1.2.3', platform: 'linux' }),
      /\(X11; Linux x86_64\)/
    );
  });

  it('rejects an unavailable Chromium version', () => {
    assert.throws(
      () => buildChromiumUserAgent({ chromeVersion: '', platform: 'darwin' }),
      /Invalid Chromium version/
    );
  });
});
