const { ipcMain, dialog, Notification, shell } = require('electron')
const { fetchVideoInfo, fetchVideoDetails, downloadVideo, cancelOne, cancelAll } = require('./downloader')
const config = require('./config')

function registerIpcHandlers(mainWindow) {
  ipcMain.handle('fetch-info', async (_event, url) => {
    try {
      return await fetchVideoInfo(url)
    } catch (err) {
      throw new Error(err.message)
    }
  })

  ipcMain.handle('fetch-details', async (_event, videoId) => {
    try {
      return await fetchVideoDetails(videoId)
    } catch (err) {
      throw new Error(err.message)
    }
  })

  ipcMain.handle('select-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('download', async (_event, url, outputDir, type, preset, videoId, subs) => {
    try {
      await downloadVideo(url, outputDir, type, preset, videoId, (progress) => {
        mainWindow.webContents.send('download-progress', progress)
      }, subs)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('cancel-one', (_event, videoId) => cancelOne(videoId))
  ipcMain.handle('cancel-all', () => cancelAll())

  ipcMain.handle('get-config', () => config.load())
  ipcMain.handle('save-config', (_event, partial) => config.save(partial))

  ipcMain.handle('notify', (_event, title, body) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })

  ipcMain.handle('open-url', (_event, url) => {
    shell.openExternal(url)
  })

  ipcMain.handle('check-update', async () => {
    try {
      const res = await fetch('https://api.github.com/repos/Vlhoseny/vidsaver/releases/latest', {
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json()
      return { version: data.tag_name || '', url: data.html_url || '' }
    } catch {
      return null
    }
  })
}

module.exports = { registerIpcHandlers }
