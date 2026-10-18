import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import type { ScenarioDataset } from '../shared/types'
import { RDeckDatabase } from './db/database'
import { generateAiContextPack } from './db/aiViews'

export const dbInstance = new RDeckDatabase()

const RECENT_FILES_CONFIG = 'recent-rdeck-files.json'

function getRecentFilesPath(): string {
  return path.join(app.getPath('userData'), RECENT_FILES_CONFIG)
}

export function getRecentFiles(): string[] {
  try {
    const p = getRecentFilesPath()
    if (!fs.existsSync(p)) return []
    const list = JSON.parse(fs.readFileSync(p, 'utf-8')) as string[]
    return list.filter((f) => fs.existsSync(f))
  } catch {
    return []
  }
}

export function addRecentFile(filePath: string): string[] {
  const existing = getRecentFiles().filter((f) => f !== filePath)
  const updated = [filePath, ...existing].slice(0, 8)
  try {
    fs.writeFileSync(getRecentFilesPath(), JSON.stringify(updated, null, 2), 'utf-8')
  } catch {
    // Ignore write errors
  }
  return updated
}

export function registerIpcHandlers(): void {
  ipcMain.handle('rdeck:initDefaultOrLastFile', () => {
    const recents = getRecentFiles()
    const defaultPath =
      recents[0] || path.join(app.getPath('userData'), 'Sample-Executive-Plan.rdeck')
    const opened = dbInstance.openFile(defaultPath, true)
    const updatedRecents = addRecentFile(defaultPath)

    // Also load the baseline scenario dataset for instant diffing
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:openFileByPath', (_evt, filePath: string, seedIfEmpty = false) => {
    const opened = dbInstance.openFile(filePath, seedIfEmpty)
    const updatedRecents = addRecentFile(filePath)
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:showOpenDialog', async (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open resourcedeck Plan (.rdeck)',
      filters: [{ name: 'resourcedeck Plan', extensions: ['rdeck'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const chosen = result.filePaths[0]
    const opened = dbInstance.openFile(chosen, false)
    const updatedRecents = addRecentFile(chosen)
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:showSaveAsDialog', async (evt, defaultName = 'New-Portfolio-Plan.rdeck') => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'Create or Save resourcedeck Plan (.rdeck)',
      defaultPath: defaultName.endsWith('.rdeck') ? defaultName : `${defaultName}.rdeck`,
      filters: [{ name: 'resourcedeck Plan', extensions: ['rdeck'] }]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    const targetPath = result.filePath.endsWith('.rdeck')
      ? result.filePath
      : `${result.filePath}.rdeck`

    // If a file is currently open, copy it to targetPath; otherwise create a fresh plan
    const currentPath = dbInstance.getFilePath()
    if (currentPath && fs.existsSync(currentPath) && currentPath !== targetPath) {
      dbInstance.close()
      fs.copyFileSync(currentPath, targetPath)
    }

    const opened = dbInstance.openFile(targetPath, false)
    const updatedRecents = addRecentFile(targetPath)
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:createNewBlankFile', async (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'Create New Blank resourcedeck Plan (.rdeck)',
      defaultPath: 'Untitled-Plan.rdeck',
      filters: [{ name: 'resourcedeck Plan', extensions: ['rdeck'] }]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    const targetPath = result.filePath.endsWith('.rdeck')
      ? result.filePath
      : `${result.filePath}.rdeck`
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath)
    }

    const opened = dbInstance.openFile(targetPath, false)
    const updatedRecents = addRecentFile(targetPath)
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:resetToSamplePortfolio', () => {
    const samplePath = path.join(app.getPath('userData'), 'Sample-Executive-Plan.rdeck')
    dbInstance.close()
    if (fs.existsSync(samplePath)) {
      fs.unlinkSync(samplePath)
    }
    const opened = dbInstance.openFile(samplePath, true)
    const updatedRecents = addRecentFile(samplePath)
    const baselineMeta =
      opened.scenarios.find((s) => s.isBaseline) || opened.scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      ...opened,
      baselineDataset,
      recentFiles: updatedRecents
    }
  })

  ipcMain.handle('rdeck:loadScenario', (_evt, scenarioId: string) => {
    const activeScenario = dbInstance.loadScenarioDataset(scenarioId)
    const scenarios = dbInstance.listScenarios()
    const baselineMeta = scenarios.find((s) => s.isBaseline) || scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      scenarios,
      activeScenario,
      baselineDataset
    }
  })

  ipcMain.handle('rdeck:saveScenarioDataset', (_evt, dataset: ScenarioDataset) => {
    dbInstance.saveScenarioDataset(dataset)
    const scenarios = dbInstance.listScenarios()
    const baselineMeta = scenarios.find((s) => s.isBaseline) || scenarios[0]
    const baselineDataset =
      baselineMeta.id === dataset.scenario.id
        ? dataset
        : dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      savedAt: new Date().toISOString(),
      scenarios,
      baselineDataset
    }
  })

  ipcMain.handle(
    'rdeck:duplicateScenario',
    (_evt, sourceScenarioId: string, newName: string, newDescription: string) => {
      const activeScenario = dbInstance.duplicateScenario(
        sourceScenarioId,
        newName,
        newDescription
      )
      const scenarios = dbInstance.listScenarios()
      const baselineMeta = scenarios.find((s) => s.isBaseline) || scenarios[0]
      const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

      return {
        scenarios,
        activeScenario,
        baselineDataset
      }
    }
  )

  ipcMain.handle('rdeck:promoteScenarioToBaseline', (_evt, scenarioId: string) => {
    const scenarios = dbInstance.promoteScenarioToBaseline(scenarioId)
    const activeScenario = dbInstance.loadScenarioDataset(scenarioId)
    return {
      scenarios,
      activeScenario,
      baselineDataset: activeScenario
    }
  })

  ipcMain.handle('rdeck:deleteScenario', (_evt, scenarioId: string) => {
    const scenarios = dbInstance.deleteScenario(scenarioId)
    const baselineMeta = scenarios.find((s) => s.isBaseline) || scenarios[0]
    const activeScenario = dbInstance.loadScenarioDataset(baselineMeta.id)
    return {
      scenarios,
      activeScenario,
      baselineDataset: activeScenario
    }
  })

  ipcMain.handle('rdeck:generateAiContextPack', (_evt, scenarioId: string) => {
    const activeScenario = dbInstance.loadScenarioDataset(scenarioId)
    const scenarios = dbInstance.listScenarios()
    const baselineMeta = scenarios.find((s) => s.isBaseline) || scenarios[0]
    const baselineDataset = dbInstance.loadScenarioDataset(baselineMeta.id)

    return {
      filePath: dbInstance.getFilePath(),
      ...generateAiContextPack(activeScenario, baselineDataset)
    }
  })

  ipcMain.handle(
    'rdeck:exportTextFile',
    async (evt, defaultFilename: string, content: string) => {
      const win = BrowserWindow.fromWebContents(evt.sender)
      const ext = path.extname(defaultFilename).replace('.', '') || 'json'
      const result = await dialog.showSaveDialog(win!, {
        title: 'Export resourcedeck Data',
        defaultPath: defaultFilename,
        filters: [{ name: `${ext.toUpperCase()} File`, extensions: [ext] }]
      })
      if (result.canceled || !result.filePath) return null
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return result.filePath
    }
  )
}
