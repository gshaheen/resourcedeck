import React, { useEffect, useRef, useState } from 'react'
import {
  GitBranch,
  FolderOpen,
  FilePlus2,
  Save,
  Undo2,
  Redo2,
  Download,
  RotateCcw,
  ChevronDown
} from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import type { ThemeId } from '../../../shared/types'
import { compareScenarios } from '../../../shared/engine/diffEngine'

const THEME_GROUPS: {
  group: string
  options: { id: ThemeId; name: string; swatch: string }[]
}[] = [
  {
    group: 'Light',
    options: [
      { id: 'boardroom-daylight', name: 'Daylight (Default)', swatch: '#f6f6f4' },
      { id: 'warm-paper', name: 'Warm Paper', swatch: '#f3efe6' },
      { id: 'nordic-frost', name: 'Nordic Frost', swatch: '#f1f5f9' }
    ]
  },
  {
    group: 'Dark',
    options: [
      { id: 'executive-slate', name: 'Slate Dark', swatch: '#181b20' },
      { id: 'midnight-velvet', name: 'Carbon Dark', swatch: '#161614' }
    ]
  },
  {
    group: 'Projector & Auto',
    options: [
      { id: 'high-contrast', name: 'High Contrast', swatch: '#ffffff' },
      { id: 'system', name: 'System Auto', swatch: '#64748b' }
    ]
  }
]

interface TopBarProps {
  onExportExecutiveSlide: () => void
  onExportCsvReport: () => void
  exportStatusMessage?: string | null
}

export const TopBar: React.FC<TopBarProps> = ({
  onExportExecutiveSlide,
  onExportCsvReport,
  exportStatusMessage
}) => {
  const {
    filePath,
    recentFiles,
    scenarios,
    dataset,
    baselineDataset,
    viewMode,
    isPresentationMode,
    isDiffDrawerOpen,
    theme,
    isSaving,
    openFileDialog,
    openFileByPath,
    saveFileAsDialog,
    createNewBlankFile,
    resetToSamplePortfolio,
    switchScenario,
    setViewMode,
    togglePresentationMode,
    setDiffDrawerOpen,
    setTheme,
    setActiveModal
  } = useDeckStore()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [confirmResetSample, setConfirmResetSample] = useState(false)

  const headerRef = useRef<HTMLElement>(null)
  const temporalStore = useDeckStore.temporal.getState()

  useEffect(() => {
    if (!fileMenuOpen && !themeMenuOpen && !exportMenuOpen) {
      setConfirmResetSample(false)
      return
    }

    const handlePointerDownOutside = (e: MouseEvent): void => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
        setThemeMenuOpen(false)
        setExportMenuOpen(false)
        setConfirmResetSample(false)
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setFileMenuOpen(false)
        setThemeMenuOpen(false)
        setExportMenuOpen(false)
        setConfirmResetSample(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDownOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDownOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [fileMenuOpen, themeMenuOpen, exportMenuOpen])

  const fileName = filePath.split(/[/\\]/).pop() || 'Portfolio.rdeck'
  const isWhatIf = !dataset.scenario.isBaseline
  const diffReport = isWhatIf ? compareScenarios(baselineDataset, dataset) : null
  const totalChangesCount = diffReport
    ? diffReport.projectDiffs.length + diffReport.staffingDiffs.length
    : 0

  return (
    <header
      ref={headerRef}
      className="h-11 border-b flex items-center justify-between gap-2 px-3 pl-20 select-none shrink-0 z-30 app-drag-region"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)'
      }}
    >
      {/* Left: Brand, File Switcher, Undo/Redo */}
      <div className="flex items-center gap-2 min-w-0 app-no-drag">
        <div
          className="flex items-center gap-1.5 shrink-0"
          style={{ color: 'var(--brand-logo)' }}
          title="resourcedeck"
        >
          <span
            className="inline-block w-2.5 h-2.5 shrink-0"
            style={{ backgroundColor: 'var(--brand-logo)' }}
            aria-hidden="true"
          />
          <span className="font-editorial font-semibold text-sm tracking-tight lowercase hidden xl:inline">
            resourcedeck
          </span>
          <span className="font-editorial font-semibold text-sm tracking-tight lowercase xl:hidden">
            rd
          </span>
        </div>

        <span style={{ color: 'var(--border-strong)' }}>/</span>

        {/* File Quick Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setFileMenuOpen(!fileMenuOpen)
              setThemeMenuOpen(false)
              setExportMenuOpen(false)
              setConfirmResetSample(false)
            }}
            aria-haspopup="menu"
            aria-expanded={fileMenuOpen}
            aria-label={`Current file: ${fileName}. Open file menu`}
            className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
          >
            <span className="max-w-[140px] truncate">{fileName}</span>
            <span
              className="w-2 h-2 shrink-0"
              style={{
                backgroundColor: isSaving ? 'var(--status-bench)' : 'var(--status-optimal)'
              }}
              title={isSaving ? 'Saving to .rdeck...' : 'Saved to .rdeck'}
            />
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {fileMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 mt-1 w-64 rounded shadow-lg border p-1 z-50"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div
                className="px-2.5 py-1.5 text-[10px] border-b mb-1 truncate"
                style={{
                  color: 'var(--text-muted)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                {filePath}
              </div>

              <button
                role="menuitem"
                onClick={() => {
                  setFileMenuOpen(false)
                  void openFileDialog()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open .rdeck...
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setFileMenuOpen(false)
                  void saveFileAsDialog()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Copy As...
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setFileMenuOpen(false)
                  void createNewBlankFile()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                New Blank File...
              </button>

              <div
                className="border-t my-1"
                style={{ borderColor: 'var(--border-subtle)' }}
              />

              {!confirmResetSample ? (
                <button
                  role="menuitem"
                  onClick={() => setConfirmResetSample(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Sample Plan...
                </button>
              ) : (
                <div
                  className="p-2 rounded border space-y-1.5"
                  style={{
                    backgroundColor: 'var(--status-overrun-bg)',
                    borderColor: 'var(--status-overrun)'
                  }}
                >
                  <div
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--status-overrun)' }}
                  >
                    Replace current plan with default sample data?
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setConfirmResetSample(false)
                        setFileMenuOpen(false)
                        void resetToSamplePortfolio()
                      }}
                      className="px-2 py-1 rounded text-[11px] font-semibold text-white"
                      style={{ backgroundColor: 'var(--status-overrun)' }}
                    >
                      Reset Plan
                    </button>
                    <button
                      onClick={() => setConfirmResetSample(false)}
                      className="px-2 py-1 rounded border text-[11px]"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {recentFiles.length > 0 && (
                <>
                  <div
                    className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wider font-semibold border-t mt-1"
                    style={{
                      color: 'var(--text-muted)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    Recent
                  </div>
                  {recentFiles.slice(0, 4).map((rf) => (
                    <button
                      role="menuitem"
                      key={rf}
                      onClick={() => {
                        setFileMenuOpen(false)
                        void openFileByPath(rf)
                      }}
                      className="w-full px-2.5 py-1 rounded text-xs text-left truncate hover:bg-black/5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {rf.split(/[/\\]/).pop()}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        {!isPresentationMode && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => temporalStore.undo()}
              title="Undo (Cmd+Z)"
              aria-label="Undo last change"
              className="p-1.5 rounded border hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => temporalStore.redo()}
              title="Redo (Cmd+Shift+Z)"
              aria-label="Redo change"
              className="p-1.5 rounded border hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Center: Scenario Selector & View Mode */}
      <div className="flex items-center gap-2 min-w-0 app-no-drag">
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded border"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: isWhatIf ? 'var(--accent-primary)' : 'var(--border-subtle)'
          }}
        >
          <GitBranch
            className="w-3 h-3 shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          />
          <select
            aria-label="Active scenario"
            value={dataset.scenario.id}
            onChange={(e) => void switchScenario(e.target.value)}
            className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[190px] truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {scenarios.map((s) => (
              <option
                key={s.id}
                value={s.id}
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              >
                {s.isBaseline ? `${s.name} (Baseline)` : `↳ ${s.name}`}
              </option>
            ))}
          </select>

          <button
            onClick={() => setActiveModal('new-scenario')}
            className="px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
            title="Create What-If Scenario Branch"
          >
            + What-If
          </button>

          {isWhatIf && (
            <button
              onClick={() => setDiffDrawerOpen(!isDiffDrawerOpen)}
              className="px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors tabular-nums"
              style={{
                backgroundColor: isDiffDrawerOpen
                  ? 'var(--accent-primary)'
                  : 'var(--bg-surface)',
                borderColor: 'var(--accent-primary)',
                color: isDiffDrawerOpen ? '#ffffff' : 'var(--accent-primary)'
              }}
            >
              Diff ({totalChangesCount})
            </button>
          )}
        </div>

        {/* Predictable 3-Mode View Switcher */}
        <div
          role="tablist"
          aria-label="Workspace view mode"
          className="flex items-center p-0.5 rounded border text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <button
            role="tab"
            aria-selected={viewMode === 'split-timeline'}
            onClick={() => setViewMode('split-timeline')}
            title="Split Timeline + Charts View (⌘1)"
            className="px-2.5 py-0.5 rounded-xs font-medium transition-colors"
            style={{
              backgroundColor:
                viewMode === 'split-timeline' ? 'var(--bg-surface)' : 'transparent',
              color:
                viewMode === 'split-timeline'
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)'
            }}
          >
            Split
          </button>

          <button
            role="tab"
            aria-selected={viewMode === 'dashboard'}
            onClick={() => setViewMode('dashboard')}
            title="Financial & Capacity Charts View (⌘2)"
            className="px-2.5 py-0.5 rounded-xs font-medium transition-colors"
            style={{
              backgroundColor:
                viewMode === 'dashboard' ? 'var(--bg-surface)' : 'transparent',
              color:
                viewMode === 'dashboard'
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)'
            }}
          >
            Charts
          </button>

          <button
            role="tab"
            aria-selected={viewMode === 'heatmap'}
            onClick={() => setViewMode('heatmap')}
            title="Resource Utilization Heatmap View (⌘3)"
            className="px-2.5 py-0.5 rounded-xs font-medium transition-colors"
            style={{
              backgroundColor:
                viewMode === 'heatmap' ? 'var(--bg-surface)' : 'transparent',
              color:
                viewMode === 'heatmap'
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)'
            }}
          >
            Heatmap
          </button>
        </div>
      </div>

      {/* Right: Data/AI Export, Theme, Present */}
      <div className="flex items-center gap-1.5 shrink-0 app-no-drag">
        {exportStatusMessage && (
          <span
            role="status"
            className="px-2 py-0.5 rounded border text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--status-optimal-bg)',
              borderColor: 'var(--status-optimal)',
              color: 'var(--status-optimal)'
            }}
          >
            {exportStatusMessage}
          </span>
        )}

        <button
          onClick={() => setActiveModal('ai-bridge')}
          className="px-2 py-1 rounded border text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
          title="Export SQL/JSON Context for AI Tools (Cmd+Shift+A)"
        >
          Data / AI
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setExportMenuOpen(!exportMenuOpen)
              setThemeMenuOpen(false)
              setFileMenuOpen(false)
            }}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-label="Export snapshot or CSV report"
            className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            <Download className="w-3 h-3" />
            <span className="hidden xl:inline">Export</span>
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-48 rounded shadow-lg border p-1 z-50"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false)
                  onExportExecutiveSlide()
                }}
                className="w-full px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
              >
                Save Snapshot (PNG)
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false)
                  onExportCsvReport()
                }}
                className="w-full px-2.5 py-1.5 rounded text-xs text-left hover:bg-black/5"
              >
                Export Rollup (CSV)
              </button>
            </div>
          )}
        </div>

        {/* Theme Picker */}
        <div className="relative">
          <button
            onClick={() => {
              setThemeMenuOpen(!themeMenuOpen)
              setFileMenuOpen(false)
              setExportMenuOpen(false)
            }}
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            className="px-2 py-1 rounded border text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Theme
          </button>

          {themeMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-52 rounded shadow-lg border p-1.5 z-50 space-y-1.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)'
              }}
            >
              {THEME_GROUPS.map((grp, idx) => (
                <div
                  key={grp.group}
                  className={idx > 0 ? 'border-t pt-1.5' : ''}
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div
                    className="px-2 pb-1 text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {grp.group}
                  </div>
                  {grp.options.map((t) => (
                    <button
                      role="menuitem"
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id)
                        setThemeMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors"
                      style={{
                        backgroundColor:
                          theme === t.id ? 'var(--bg-elevated)' : 'transparent',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <span
                        className="w-3 h-3 border shrink-0"
                        style={{
                          backgroundColor: t.swatch,
                          borderColor: 'var(--border-strong)'
                        }}
                      />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={togglePresentationMode}
          title="Toggle Presentation Mode (Cmd+P)"
          className="px-2.5 py-1 rounded text-xs font-medium border transition-colors"
          style={{
            backgroundColor: isPresentationMode
              ? 'var(--text-primary)'
              : 'var(--bg-elevated)',
            borderColor: isPresentationMode
              ? 'var(--text-primary)'
              : 'var(--border-strong)',
            color: isPresentationMode ? 'var(--bg-surface)' : 'var(--text-primary)'
          }}
        >
          {isPresentationMode ? 'Exit Present' : 'Present'}
        </button>
      </div>
    </header>
  )
}
