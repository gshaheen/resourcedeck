import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { dbInstance, registerIpcHandlers } from './ipc'

// Ensure application name is always 'resourcedeck' in macOS menu bar & About panel
app.name = 'resourcedeck'
app.setName('resourcedeck')

let mainWindow: BrowserWindow | null = null
let pendingFileToOpen: string | null = null

function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'resourcedeck',
            submenu: [
              { role: 'about' as const, label: 'About resourcedeck' },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: 'Hide resourcedeck' },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Quit resourcedeck' }
            ]
          }
        ]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    title: 'resourcedeck',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (pendingFileToOpen) {
      mainWindow?.webContents.send('rdeck:externalFileOpened', pendingFileToOpen)
      pendingFileToOpen = null
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupZeroTelemetryAutoUpdater(): void {
  // Privacy & Local-First: No telemetry, only standard release manifest check
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('rdeck:updateStatus', {
      status: 'downloading',
      version: info.version
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('rdeck:updateStatus', {
      status: 'ready',
      version: info.version
    })
  })

  autoUpdater.on('error', () => {
    // Fail silently when offline or in local dev builds without a release feed
  })

  ipcMain.handle('rdeck:quitAndInstallUpdate', () => {
    autoUpdater.quitAndInstall()
  })

  if (!is.dev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        // Offline or no GitHub Release published yet
      })
    }, 3000)
  }
}

// Handle macOS double-click on a .rdeck file in Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (filePath.endsWith('.rdeck')) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rdeck:externalFileOpened', filePath)
    } else {
      pendingFileToOpen = filePath
    }
  }
})

app.whenReady().then(() => {
  app.setName('resourcedeck')
  electronApp.setAppUserModelId('com.resourcedeck.app')
  setupApplicationMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  setupZeroTelemetryAutoUpdater()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  dbInstance.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  dbInstance.close()
})
