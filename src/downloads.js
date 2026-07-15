const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const wired = new WeakSet();
/** id -> { record, item } */
const live = new Map();
let seq = 0;

function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

/**
 * @param {Electron.Session} ses
 * @param {{ persist: boolean, onChange: (record: object) => void }} opts
 */
function attachDownloads(ses, opts) {
  if (wired.has(ses)) return;
  wired.add(ses);

  ses.on('will-download', (_e, item) => {
    const id = `d${++seq}`;
    const savePath = uniquePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(savePath);

    const record = {
      id,
      filename: path.basename(savePath),
      savePath,
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now(),
      persist: opts.persist,
    };
    live.set(id, { record, item });
    opts.onChange(record);

    item.on('updated', (_ev, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.state = state === 'interrupted' ? 'interrupted' : 'progressing';
      opts.onChange(record);
    });
    item.on('done', (_ev, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.state = state; // 'completed' | 'cancelled' | 'interrupted'
      record.endedAt = Date.now();
      live.delete(id);
      opts.onChange(record, true);
    });
  });
}

function listLive() {
  return [...live.values()].map((x) => x.record);
}

function cancelDownload(id) {
  const entry = live.get(id);
  if (entry) entry.item.cancel();
}

module.exports = { attachDownloads, listLive, cancelDownload };
