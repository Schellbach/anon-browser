/**
 * Compact tracker / ad host blocklist for Shields.
 * Not a full EasyList — enough for a strong default MVP.
 */

const BLOCKED_HOSTS = new Set([
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'facebook.net',
  'facebook.com',
  'connect.facebook.net',
  'scorecardresearch.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'ads.yahoo.com',
  'adsystem.amazon.com',
  'amazon-adsystem.com',
  'ads-twitter.com',
  'static.ads-twitter.com',
  'analytics.twitter.com',
  'hotjar.com',
  'mouseflow.com',
  'fullstory.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'newrelic.com',
  'nr-data.net',
  'sentry-cdn.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'pubmatic.com',
  'openx.net',
  'rubiconproject.com',
  'casalemedia.com',
  'advertising.com',
  'adnxs.com',
  'adsrvr.org',
  'moatads.com',
  'quantserve.com',
  'quantcount.com',
  'chartbeat.com',
  'chartbeat.net',
  'optimizely.com',
  'crazyegg.com',
  'clarity.ms',
  'bat.bing.com',
  'ads.linkedin.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'tr.snapchat.com',
  'sc-static.net',
  'tiktok.com',
  'analytics.tiktok.com',
  'ads.tiktok.com',
  'pinterest.com',
  'ct.pinterest.com',
  'ads.pinterest.com',
  // Extra common trackers / ad tech
  '2mdn.net',
  'adsafeprotected.com',
  'adform.net',
  'adcolony.com',
  'adobedtm.com',
  'demdex.net',
  'omtrdc.net',
  'everesttech.net',
  'bluekai.com',
  'exelator.com',
  'krxd.net',
  'liadm.com',
  'mathtag.com',
  'media.net',
  'mgid.com',
  'moatpixel.com',
  'mookie1.com',
  'nexac.com',
  'partner.googleadservices.com',
  'rlcdn.com',
  'serving-sys.com',
  'sharethrough.com',
  'smartadserver.com',
  'spotxchange.com',
  'teads.tv',
  'triplelift.com',
  'turn.com',
  'yieldmo.com',
  'zemanta.com',
  'bidswitch.net',
  'contextweb.com',
  'gumgum.com',
  'inmobi.com',
  'tapad.com',
  'agkn.com',
  'rfihub.com',
  'sitescout.com',
  'steadycdn.com',
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'kochava.com',
  'singular.net',
  'statcounter.com',
  'histats.com',
  'addthis.com',
  'addtoany.com',
  'sharethis.com',
  'disqus.com',
  'disquscdn.com',
  'gravatar.com',
  'outbrainimg.com',
  'taboola.com',
  'trc.taboola.com',
  'widget.intercom.io',
  'js.intercomcdn.com',
  'cdn.heapanalytics.com',
  'heapanalytics.com',
  'cdn.mouseflow.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'vars.hotjar.com',
  'googleoptimize.com',
  'doubleclickbygoogle.com',
  'g.doubleclick.net',
  'cm.g.doubleclick.net',
  'pagead2.googleadservices.com',
  'adservice.google.co.uk',
  'adservice.google.ca',
  'adservice.google.de',
  'facebook.com',
  'fbcdn.net',
  'fbsbx.com',
]);

/**
 * Scareware / fake-AV / forced-redirect hosts. Unlike ad hosts these are
 * blocked even as main-frame navigations (the whole page is the attack).
 * Seeded from real incidents hit through news-site ad chains.
 */
const BADWARE_HOSTS = new Set([
  'augustindataservices.com',
  'qwerty-trck.com',
  'hyrala.com',
  'reimageplus.com',
  'safepcrepair.com',
  'fix-my-pc.net',
  'mackeeper.com',
  'mackeeperapp.mackeeper.com',
  'systweak.com',
  'pchelpsoft.com',
  'driverupdate.net',
  'slimcleaner.com',
  'reimagerepair.com',
  'errorsfixer.com',
  'scan-alert.com',
  'security-alert.center',
  'virus-alert.info',
  'microsoft-alert.com',
  'apple-alert.com',
  'apple-security-alert.com',
  'amazonaws-security.com',
  'push-notifications.info',
  'trackpushnotify.com',
  'clickadu.com',
  'propellerads.com',
  'popads.net',
  'popcash.net',
  'adcash.com',
  'revcontent.com',
  'trafficjunky.com',
  'exoclick.com',
  'juicyads.com',
  'adsterra.com',
  'hilltopads.net',
  'richads.com',
  'onclickads.net',
  'pushwhy.com',
  'notix.io',
]);

const BLOCKED_PATH_HINTS = [
  '/ads?',
  '/ads/',
  '/ad/',
  '/advert',
  'pagead',
  'pixel.',
  '/pixel/',
  'tracking.',
  '/track?',
  'beacon.',
  '/beacon',
  'collect?',
  '/collect',
  'telemetry',
];

function hostMatches(url, set) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function shouldBlockUrl(url) {
  if (hostMatches(url, BLOCKED_HOSTS)) return true;
  const full = url.toLowerCase();
  if (!/^https?:/.test(full)) return false;
  return BLOCKED_PATH_HINTS.some((h) => full.includes(h));
}

/**
 * Scareware / forced-redirect host — blockable even as a main-frame load.
 * @param {string} url
 * @returns {boolean}
 */
function isBadwareUrl(url) {
  return hostMatches(url, BADWARE_HOSTS);
}

module.exports = { shouldBlockUrl, isBadwareUrl, BLOCKED_HOSTS, BADWARE_HOSTS };
