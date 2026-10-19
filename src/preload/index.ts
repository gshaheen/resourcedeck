import { contextBridge, ipcRenderer } from 'electron'
import type { Scenario, ScenarioDataset } from '../shared/types'

export interface FileSessionResult {
  filePath: string
  scenarios: Scenario[]
  activeScenario: ScenarioDataset
  baselineDataset: ScenarioDataset
  recentFiles: string[]
}

export interface RDeckBridgeApi {
  initDefaultOrLastFile: () => Promise<FileSessionResult>
  openFileByPath: (filePath: string, seedIfEmpty?: boolean) => Promise<FileSessionResult>
  showOpenDialog: () => Promise<FileSessionResult | null>
  showSaveAsDialog: (defaultName?: string) => Promise<FileSessionResult | null>
  createNewBlankFile: () => Promise<FileSessionResult | null>
  resetToSamplePortfolio: () => Promise<FileSessionResult>
  loadScenario: (scenarioId: string) => Promise<{
    scenarios: Scenario[]
    activeScenario: ScenarioDataset
    baselineDataset: ScenarioDataset
  }>
  saveScenarioDataset: (dataset: ScenarioDataset) => Promise<{
    savedAt: string
    scenarios: Scenario[]
    baselineDataset: ScenarioDataset
  }>
  duplicateScenario: (
    sourceScenarioId: string,
    newName: string,
    newDescription?: string
  ) => Promise<{
    scenarios: Scenario[]
    activeScenario: ScenarioDataset
    baselineDataset: ScenarioDataset
  }>
  promoteScenarioToBaseline: (scenarioId: string) => Promise<{
    scenarios: Scenario[]
    activeScenario: ScenarioDataset
    baselineDataset: ScenarioDataset
  }>
  deleteScenario: (scenarioId: string) => Promise<{
    scenarios: Scenario[]
    activeScenario: ScenarioDataset
    baselineDataset: ScenarioDataset
  }>
  generateAiContextPack: (scenarioId: string) => Promise<{
    filePath: string | null
    markdownPromptPack: string
    jsonBundle: string
  }>
  exportTextFile: (defaultFilename: string, content: string) => Promise<string | null>
  openExternalUrl: (url: string) => Promise<boolean>
  quitAndInstallUpdate: () => Promise<void>
  onExternalFileOpened: (callback: (filePath: string) => void) => () => void
  onUpdateStatus: (
    callback: (info: { status: 'downloading' | 'ready'; version: string }) => void
  ) => () => void
}

const rdeckApi: RDeckBridgeApi = {
  initDefaultOrLastFile: () => ipcRenderer.invoke('rdeck:initDefaultOrLastFile'),
  openFileByPath: (filePath, seedIfEmpty = false) =>
    ipcRenderer.invoke('rdeck:openFileByPath', filePath, seedIfEmpty),
  showOpenDialog: () => ipcRenderer.invoke('rdeck:showOpenDialog'),
  showSaveAsDialog: (defaultName) =>
    ipcRenderer.invoke('rdeck:showSaveAsDialog', defaultName),
  createNewBlankFile: () => ipcRenderer.invoke('rdeck:createNewBlankFile'),
  resetToSamplePortfolio: () => ipcRenderer.invoke('rdeck:resetToSamplePortfolio'),
  loadScenario: (scenarioId) => ipcRenderer.invoke('rdeck:loadScenario', scenarioId),
  saveScenarioDataset: (dataset) =>
    ipcRenderer.invoke('rdeck:saveScenarioDataset', dataset),
  duplicateScenario: (sourceScenarioId, newName, newDescription = '') =>
    ipcRenderer.invoke(
      'rdeck:duplicateScenario',
      sourceScenarioId,
      newName,
      newDescription
    ),
  promoteScenarioToBaseline: (scenarioId) =>
    ipcRenderer.invoke('rdeck:promoteScenarioToBaseline', scenarioId),
  deleteScenario: (scenarioId) => ipcRenderer.invoke('rdeck:deleteScenario', scenarioId),
  generateAiContextPack: (scenarioId) =>
    ipcRenderer.invoke('rdeck:generateAiContextPack', scenarioId),
  exportTextFile: (defaultFilename, content) =>
    ipcRenderer.invoke('rdeck:exportTextFile', defaultFilename, content),
  openExternalUrl: (url) => ipcRenderer.invoke('rdeck:openExternalUrl', url),
  quitAndInstallUpdate: () => ipcRenderer.invoke('rdeck:quitAndInstallUpdate'),
  onExternalFileOpened: (callback) => {
    const handler = (_event: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on('rdeck:externalFileOpened', handler)
    return () => ipcRenderer.removeListener('rdeck:externalFileOpened', handler)
  },
  onUpdateStatus: (callback) => {
    const handler = (
      _event: unknown,
      info: { status: 'downloading' | 'ready'; version: string }
    ): void => callback(info)
    ipcRenderer.on('rdeck:updateStatus', handler)
    return () => ipcRenderer.removeListener('rdeck:updateStatus', handler)
  }
}

contextBridge.exposeInMainWorld('rdeck', rdeckApi)
