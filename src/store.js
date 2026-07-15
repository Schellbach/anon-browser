const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function storePath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(name, fallback) {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(storePath(name), 'utf8')) };
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(name, data) {
  fs.mkdirSync(path.dirname(storePath(name)), { recursive: true });
  fs.writeFileSync(storePath(name), JSON.stringify(data, null, 2));
}

const DEFAULT_SETTINGS = {
  globalShields: true,
  httpsUpgrade: true,
  fingerprintResist: true,
  showBookmarksBar: true,
  torSocksHost: '127.0.0.1',
  torSocksPort: 9050,
  walletNetwork: 'mainnet',
};

const DEFAULT_BOOKMARKS = {
  items: [],
};

const DEFAULT_HISTORY = { entries: [] };

const DEFAULT_DOWNLOADS = { items: [] };

class AppStore {
  constructor() {
    this.settings = readJson('settings.json', DEFAULT_SETTINGS);
    this.bookmarks = readJson('bookmarks.json', DEFAULT_BOOKMARKS);
    this.history = readJson('history.json', DEFAULT_HISTORY);
    this.downloads = readJson('downloads.json', DEFAULT_DOWNLOADS);
  }

  saveSettings() {
    writeJson('settings.json', this.settings);
  }

  saveDownloads() {
    writeJson('downloads.json', this.downloads);
  }

  addDownload(record) {
    this.downloads.items.unshift({
      id: record.id,
      filename: record.filename,
      savePath: record.savePath,
      url: record.url,
      totalBytes: record.totalBytes,
      state: record.state,
      endedAt: record.endedAt || Date.now(),
    });
    if (this.downloads.items.length > 200) {
      this.downloads.items = this.downloads.items.slice(0, 200);
    }
    this.saveDownloads();
  }

  clearDownloads() {
    this.downloads.items = [];
    this.saveDownloads();
  }

  saveBookmarks() {
    writeJson('bookmarks.json', this.bookmarks);
  }

  saveHistory() {
    writeJson('history.json', this.history);
  }

  addBookmark(title, url) {
    const id = `b${Date.now()}`;
    this.bookmarks.items.push({
      id,
      title: title || url,
      url,
    });
    this.saveBookmarks();
    return this.bookmarks.items;
  }

  removeBookmark(id) {
    this.bookmarks.items = this.bookmarks.items.filter((b) => b.id !== id);
    this.saveBookmarks();
    return this.bookmarks.items;
  }

  isBookmarked(url) {
    return this.bookmarks.items.some((b) => b.url === url);
  }

  toggleBookmark(title, url) {
    const existing = this.bookmarks.items.find((b) => b.url === url);
    if (existing) return this.removeBookmark(existing.id);
    return this.addBookmark(title, url);
  }

  recordHistory(title, url) {
    if (!url || url.startsWith('anon://') || url.startsWith('file:')) return;
    this.history.entries = this.history.entries.filter((e) => e.url !== url);
    this.history.entries.unshift({
      id: `h${Date.now()}`,
      title: title || url,
      url,
      at: Date.now(),
    });
    if (this.history.entries.length > 500) {
      this.history.entries = this.history.entries.slice(0, 500);
    }
    this.saveHistory();
  }

  clearHistory() {
    this.history.entries = [];
    this.saveHistory();
  }

  clearBrowsingData() {
    this.clearHistory();
  }
}

module.exports = { AppStore, DEFAULT_SETTINGS };
