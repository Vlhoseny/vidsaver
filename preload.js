const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
  fetchDetails: (videoId) => ipcRenderer.invoke('fetch-details', videoId),
  download: (url, outputDir, type, preset, videoId, subs) =>
    ipcRenderer.invoke('download', url, outputDir, type, preset, videoId, subs),
  selectDir: () => ipcRenderer.invoke('select-dir'),
  cancelOne: (videoId) => ipcRenderer.invoke('cancel-one', videoId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
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
