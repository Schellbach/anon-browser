const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anon', {
  goto: (url) => ipcRenderer.invoke('nav:goto', url),
  back: () => ipcRenderer.invoke('nav:back'),
  forward: () => ipcRenderer.invoke('nav:forward'),
  reload: () => ipcRenderer.invoke('nav:reload'),
  home: () => ipcRenderer.invoke('nav:home'),
  createTab: (url) => ipcRenderer.invoke('tabs:create', url),
  closeTab: (id) => ipcRenderer.invoke('tabs:close', id),
  switchTab: (id) => ipcRenderer.invoke('tabs:switch', id),
  getState: () => ipcRenderer.invoke('tabs:state'),
  openShieldsPanel: (rect) => ipcRenderer.invoke('shields:panel', rect),
  newWindow: () => ipcRenderer.invoke('window:new'),
  newPrivateWindow: () => ipcRenderer.invoke('window:newPrivate'),
  newTorWindow: () => ipcRenderer.invoke('window:newTor'),
  toggleBookmark: () => ipcRenderer.invoke('bookmarks:toggle'),
  findVisible: (visible) => ipcRenderer.invoke('find:visible', visible),
  findQuery: (opts) => ipcRenderer.invoke('find:query', opts),
  onState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('chrome:state', handler);
    return () => ipcRenderer.removeListener('chrome:state', handler);
  },
  onBlocked: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('chrome:blocked', handler);
    return () => ipcRenderer.removeListener('chrome:blocked', handler);
  },
  onLoading: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('chrome:loading', handler);
    return () => ipcRenderer.removeListener('chrome:loading', handler);
  },
  onFindShow: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('chrome:find-show', handler);
    return () => ipcRenderer.removeListener('chrome:find-show', handler);
  },
  onFindResult: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('chrome:find-result', handler);
    return () => ipcRenderer.removeListener('chrome:find-result', handler);
  },
});
