const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shieldsPanel', {
  info: () => ipcRenderer.invoke('shieldsPanel:info'),
  setSite: (on) => ipcRenderer.invoke('shieldsPanel:setSite', on),
  setGlobal: (on) => ipcRenderer.invoke('shieldsPanel:setGlobal', on),
  close: () => ipcRenderer.invoke('shieldsPanel:close'),
});
