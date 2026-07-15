const fs = require('fs');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function fromChromeJson(raw) {
  const data = JSON.parse(raw);
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'url' && /^https?:/i.test(node.url || '')) {
      out.push({ title: node.name || node.url, url: node.url });
    }
    for (const child of node.children || []) walk(child);
  };
  for (const root of Object.values(data.roots || {})) walk(root);
  return out;
}

function fromNetscapeHtml(raw) {
  const out = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const url = decodeEntities(m[1]);
    if (!/^https?:/i.test(url)) continue;
    const title = decodeEntities(m[2].replace(/<[^>]*>/g, '').trim());
    out.push({ title: title || url, url });
  }
  return out;
}

/**
 * Parse a Chrome/Brave `Bookmarks` JSON file or a Netscape bookmarks HTML
 * export into { title, url } entries (deduped by url).
 * @param {string} filePath
 */
function parseBookmarksFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = raw.trimStart().startsWith('{')
    ? fromChromeJson(raw)
    : fromNetscapeHtml(raw);
  const seen = new Set();
  return entries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

module.exports = { parseBookmarksFile };
