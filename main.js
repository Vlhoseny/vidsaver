const { app, BrowserWindow } = require('electron')
const path = require('path')
const { registerIpcHandlers } = require('./ipc')
const config = require('./config')

let mainWindow

function createWindow() {
  config.load()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 700,
    minHeight: 500,
    title: 'VidSaver - YouTube Downloader',
    icon: path.join(__dirname, 'renderer', 'icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  registerIpcHandlers(mainWindow)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
