const PLATFORM_TOKENS = {
  darwin: 'Macintosh; Intel Mac OS X 10_15_7',
  win32: 'Windows NT 10.0; Win64; x64',
  linux: 'X11; Linux x86_64',
};

/**
 * Build Chromium's reduced desktop user-agent shape without Electron's
 * application/version token. The Chromium major is derived from the runtime,
 * so HTTP and JavaScript continue to report the engine actually in use.
 *
 * @param {{ chromeVersion?: string, platform?: NodeJS.Platform }} [options]
 */
function buildChromiumUserAgent({
  chromeVersion = process.versions.chrome,
  platform = process.platform,
} = {}) {
  const major = String(chromeVersion || '').match(/^(\d+)\./)?.[1];
  if (!major) throw new Error(`Invalid Chromium version: ${chromeVersion}`);
  const platformToken = PLATFORM_TOKENS[platform] || PLATFORM_TOKENS.linux;
  return (
    `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
  );
}

module.exports = { buildChromiumUserAgent };
