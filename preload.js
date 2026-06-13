const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
  fetchDetails: (videoId) => ipcRenderer.invoke('fetch-details', videoId),
  download: (url, outputDir, type, preset, videoId) =>
    ipcRenderer.invoke('download', url, outputDir, type, preset, videoId),
  selectDir: () => ipcRenderer.invoke('select-dir'),
  cancelOne: (videoId) => ipcRenderer.invoke('cancel-one', videoId),
  pauseOne: (videoId) => ipcRenderer.invoke('pause-one', videoId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  onProgress: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (partial) => ipcRenderer.invoke('save-config', partial),
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
})
