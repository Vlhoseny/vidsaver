const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron')
const path = require('path')
const { spawnSync } = require('child_process')
const { registerIpcHandlers } = require('./ipc')
const config = require('./config')

let mainWindow
let tray = null

function checkYtDlp() {
  const result = spawnSync('yt-dlp', ['--version'], { windowsHide: true, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    dialog.showErrorBox('Missing yt-dlp',
      'yt-dlp was not found on your system PATH.\n\n' +
      'Install it with: pip install yt-dlp\n\n' +
      'Then restart VidSaver.')
    return false
  }
  return true
}

function createWindow() {
  config.load()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 700,
    minHeight: 500,
    title: 'VidSaver - YouTube Downloader',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  registerIpcHandlers(mainWindow)

  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'renderer', 'icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('VidSaver')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show VidSaver',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray = null
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  if (!checkYtDlp()) return
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
