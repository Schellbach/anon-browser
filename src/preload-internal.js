const { contextBridge, ipcRenderer } = require('electron');

// Internal pages only (anon:// → file://)
// Vault, Settings, History, Bookmarks, Downloads, NewTab, Agent

contextBridge.exposeInMainWorld('anonVault', {
  state: () => ipcRenderer.invoke('vault:state'),
  create: (pass) => ipcRenderer.invoke('vault:create', pass),
  import: (pass, secret) => ipcRenderer.invoke('vault:import', { pass, secret }),
  unlock: (pass) => ipcRenderer.invoke('vault:unlock', pass),
  lock: () => ipcRenderer.invoke('vault:lock'),
  refresh: () => ipcRenderer.invoke('vault:refresh'),
  receive: () => ipcRenderer.invoke('vault:receive'),
  estimate: (to, amount) => ipcRenderer.invoke('vault:estimate', { to, amount }),
  send: (pass, to, amount) => ipcRenderer.invoke('vault:send', { pass, to, amount }),
  destroy: (pass) => ipcRenderer.invoke('vault:destroy', pass),
});

contextBridge.exposeInMainWorld('anonNav', {
  goto: (url) => ipcRenderer.invoke('nav:goto', url),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  setGlobalShields: (on) => ipcRenderer.invoke('shields:setGlobal', on),
  getState: () => ipcRenderer.invoke('tabs:state'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  listBookmarks: () => ipcRenderer.invoke('bookmarks:list'),
  removeBookmark: (id) => ipcRenderer.invoke('bookmarks:remove', id),
  listHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  clearBrowsingData: () => ipcRenderer.invoke('data:clearBrowsing'),
  newPrivateWindow: () => ipcRenderer.invoke('window:newPrivate'),
  newTorWindow: () => ipcRenderer.invoke('window:newTor'),
  torStatus: () => ipcRenderer.invoke('tor:status'),
  torGet: () => ipcRenderer.invoke('tor:get'),
  torSetSocks: (host, port) => ipcRenderer.invoke('tor:setSocks', { host, port }),
});

contextBridge.exposeInMainWorld('anonDownloads', {
  list: () => ipcRenderer.invoke('downloads:list'),
  cancel: (id) => ipcRenderer.invoke('downloads:cancel', id),
  open: (savePath) => ipcRenderer.invoke('downloads:open', savePath),
  reveal: (savePath) => ipcRenderer.invoke('downloads:reveal', savePath),
  clear: () => ipcRenderer.invoke('downloads:clear'),
  onChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('downloads:changed', handler);
    return () => ipcRenderer.removeListener('downloads:changed', handler);
  },
});
