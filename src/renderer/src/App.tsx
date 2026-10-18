import React, { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { toPng } from 'html-to-image'
import Papa from 'papaparse'
import { ArrowDownCircle, GripVertical } from 'lucide-react'
import { useDeckStore } from './store/useDeckStore'
import { TopBar } from './components/TopBar'
import { LeftSidebar } from './components/LeftSidebar'
import { GanttTimeline } from './components/GanttTimeline'
import { ChartsPanel } from './components/ChartsPanel'
import { UtilizationHeatmap } from './components/UtilizationHeatmap'
import { ScenarioDiffDrawer } from './components/ScenarioDiffDrawer'
import { ExecutiveKpiBar } from './components/ExecutiveKpiBar'
import { ModalsContainer } from './components/ModalsContainer'
import { calculateScenarioMonthlyRollup } from '../../shared/engine/calculator'
import type { Person, Project } from '../../shared/types'

export const App: React.FC = () => {
  const {
    dataset,
    chartFilter,
    viewMode,
    isChartsMinimized,
    isPresentationMode,
    selectedPersonIds,
    initializeSession,
    openFileByPath,
    moveProjectStatus,
    setPendingDropAssignment,
    togglePresentationMode,
    setViewMode,
    setActiveModal
  } = useDeckStore()

  const workspaceCaptureRef = useRef<HTMLDivElement>(null)
  const mainColumnRef = useRef<HTMLElement>(null)

  // Resizable Sidebar Width (px) & Timeline Split Height (%)
  const [sidebarWidth, setSidebarWidth] = useState<number>(280)
  const [timelineHeightPct, setTimelineHeightPct] = useState<number>(42)
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null)

  // Active Dragged Item for DragOverlay (follows cursor smoothly across scroll containers!)
  const [activeDragData, setActiveDragData] = useState<
    | { type: 'deck-project'; project: Project }
    | { type: 'sidebar-person'; people: Person[] }
    | null
  >(null)

  const [updateBanner, setUpdateBanner] = useState<{
    status: 'downloading' | 'ready'
    version: string
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  )

  useEffect(() => {
    void initializeSession()

    if (window.rdeck) {
      const unsubFile = window.rdeck.onExternalFileOpened((fp) => {
        void openFileByPath(fp)
      })
      const unsubUpdate = window.rdeck.onUpdateStatus((info) => {
        setUpdateBanner(info)
      })
      return () => {
        unsubFile()
        unsubUpdate()
      }
    }
    return undefined
  }, [initializeSession, openFileByPath])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const isCmd = e.metaKey || e.ctrlKey
      if (isCmd && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePresentationMode()
      } else if (isCmd && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setActiveModal('ai-bridge')
      } else if (isCmd && !e.shiftKey && e.key === '1') {
        e.preventDefault()
        setViewMode('split-timeline')
      } else if (isCmd && !e.shiftKey && e.key === '2') {
        e.preventDefault()
        setViewMode('dashboard')
      } else if (isCmd && !e.shiftKey && e.key === '3') {
        e.preventDefault()
        setViewMode('heatmap')
      } else if (
        isCmd &&
        e.key.toLowerCase() === 'z' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName || ''
        )
      ) {
        e.preventDefault()
        if (e.shiftKey) {
          useDeckStore.temporal.getState().redo()
        } else {
          useDeckStore.temporal.getState().undo()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePresentationMode, setViewMode, setActiveModal])

  const handleDragStart = (event: DragStartEvent): void => {
    const current = event.active.data.current
    if (current?.type === 'deck-project') {
      setActiveDragData({ type: 'deck-project', project: current.project as Project })
    } else if (current?.type === 'sidebar-person') {
      const draggedPerson = current.person as Person
      const isPartOfSelection = selectedPersonIds.includes(draggedPerson.id)
      const peopleToDrag = isPartOfSelection
        ? dataset.people.filter((p) => selectedPersonIds.includes(p.id))
        : [draggedPerson]
      setActiveDragData({
        type: 'sidebar-person',
        people: peopleToDrag.length > 0 ? peopleToDrag : [draggedPerson]
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const draggedPeople =
      activeDragData?.type === 'sidebar-person' ? activeDragData.people : null
    setActiveDragData(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    if (
      activeData?.type === 'deck-project' &&
      (overData?.type === 'timeline-canvas' || overData?.type === 'timeline-project')
    ) {
      moveProjectStatus(activeData.project.id, 'timeline')
    } else if (
      activeData?.type === 'sidebar-person' &&
      overData?.type === 'timeline-project'
    ) {
      const draggedPerson = activeData.person as Person
      const personIds =
        draggedPeople && draggedPeople.length > 0
          ? draggedPeople.map((p) => p.id)
          : selectedPersonIds.includes(draggedPerson.id)
            ? selectedPersonIds
            : [draggedPerson.id]
      setPendingDropAssignment({
        projectId: overData.project.id,
        personIds
      })
    }
  }

  // Horizontal Sidebar Resize Handler
  const startSidebarResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (moveEvt: PointerEvent): void => {
      const next = Math.max(220, Math.min(440, startWidth + (moveEvt.clientX - startX)))
      setSidebarWidth(next)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Vertical Timeline / Charts Split Resize Handler
  const startTimelineHeightResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const colEl = mainColumnRef.current
    if (!colEl) return
    const colRect = colEl.getBoundingClientRect()

    const onMove = (moveEvt: PointerEvent): void => {
      const relY = moveEvt.clientY - colRect.top
      const pct = Math.max(22, Math.min(68, Math.round((relY / colRect.height) * 100)))
      setTimelineHeightPct(pct)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const showTransientExportMessage = (msg: string): void => {
    setExportStatusMessage(msg)
    window.setTimeout(() => {
      setExportStatusMessage((curr) => (curr === msg ? null : curr))
    }, 2600)
  }

  const handleExportExecutiveSlide = async (): Promise<void> => {
    const targetEl = mainColumnRef.current || workspaceCaptureRef.current
    if (!targetEl) return
    try {
      showTransientExportMessage('Rendering PNG...')
      const dataUrl = await toPng(targetEl, {
        pixelRatio: 2,
        cacheBust: true
      })
      const link = document.createElement('a')
      link.download = `${dataset.scenario.name.replace(/\s+/g, '-')}-Snapshot.png`
      link.href = dataUrl
      link.click()
      showTransientExportMessage('Saved PNG Snapshot')
    } catch (err) {
      console.error('Failed to export PNG slide:', err)
      showTransientExportMessage('PNG Export Failed')
    }
  }

  const handleExportCsvReport = async (): Promise<void> => {
    const rollups = calculateScenarioMonthlyRollup(dataset, chartFilter)
    const csv = Papa.unparse(
      rollups.map((r) => ({
        Month: r.yearMonth,
        WorkingWeekdays: r.workingWeekdays,
        CapacityHours: r.capacityHours,
        ConfirmedDemandHours: r.confirmedDemandHours,
        TentativeDemandHours: r.tentativeDemandHours,
        TotalDemandHours: r.totalDemandHours,
        UtilizationPercent: `${r.utilizationPercent}%`,
        CapacityOverrun: r.isCapacityOverrun ? 'YES' : 'NO',
        MonthlyBudget: Math.round(r.budgetAmount),
        TotalCost: Math.round(r.totalCost),
        LaborCost: Math.round(r.laborCost),
        NonLaborCost: Math.round(r.nonLaborCost),
        BudgetOverrun: r.isBudgetOverrun ? 'YES' : 'NO'
      }))
    )

    if (window.rdeck) {
      const ok = await window.rdeck.exportTextFile(
        `${dataset.scenario.name.replace(/\s+/g, '-')}-Monthly-Rollup.csv`,
        csv
      )
      if (ok) {
        showTransientExportMessage('Saved CSV Rollup')
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragData(null)}
    >
      <div
        className="h-screen w-screen flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)'
        }}
      >
        <TopBar
          onExportExecutiveSlide={() => void handleExportExecutiveSlide()}
          onExportCsvReport={() => void handleExportCsvReport()}
          exportStatusMessage={exportStatusMessage}
        />

        <div
          ref={workspaceCaptureRef}
          className="flex-1 min-h-0 flex overflow-hidden relative"
        >
          <LeftSidebar width={sidebarWidth} />

          {/* Interactive Vertical Resizer Handle between Sidebar and Main Workspace */}
          {!isPresentationMode && (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Resize sidebar width (Left/Right arrow keys)"
              onPointerDown={startSidebarResize}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setSidebarWidth((w) => Math.max(220, w - 16))
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setSidebarWidth((w) => Math.min(440, w + 16))
                }
              }}
              className="w-1.5 cursor-col-resize transition-colors shrink-0 z-20"
              style={{ backgroundColor: 'var(--border-subtle)' }}
              title="Drag or use Left/Right arrows to resize sidebar width"
            />
          )}

          <main
            ref={mainColumnRef}
            className="flex-1 min-w-0 flex flex-col overflow-hidden"
          >
            <ExecutiveKpiBar />

            {viewMode === 'heatmap' ? (
              <UtilizationHeatmap />
            ) : (
              <>
                {viewMode === 'split-timeline' && (
                  <>
                    <GanttTimeline
                      heightPercent={isChartsMinimized ? 100 : timelineHeightPct}
                    />
                    {/* Interactive Horizontal Resizer Handle between Timeline and Charts (hidden when charts are minimized) */}
                    {!isChartsMinimized && (
                      <div
                        role="separator"
                        tabIndex={0}
                        aria-orientation="horizontal"
                        aria-label="Resize timeline vs charts height (Up/Down arrow keys)"
                        onPointerDown={startTimelineHeightResize}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setTimelineHeightPct((h) => Math.max(22, h - 4))
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setTimelineHeightPct((h) => Math.min(68, h + 4))
                          }
                        }}
                        style={{ backgroundColor: 'var(--border-subtle)' }}
                        className="h-2 cursor-row-resize transition-colors shrink-0 z-20 flex items-center justify-center"
                        title="Drag or use Up/Down arrows to adjust Timeline vs. Charts height"
                      >
                        <div
                          className="w-8 h-0.5"
                          style={{ backgroundColor: 'var(--border-strong)' }}
                        />
                      </div>
                    )}
                  </>
                )}
                <ChartsPanel />
              </>
            )}
          </main>

          <ScenarioDiffDrawer />
        </div>

        {/* Cursor-Following DragOverlay (Renders above scroll containers so dragged People & Projects always follow the pointer!) */}
        <DragOverlay dropAnimation={null}>
          {activeDragData?.type === 'sidebar-person' && (
            <div
              className="relative pointer-events-none"
              style={{
                transform: 'translate(14px, 14px)'
              }}
            >
              {/* Stacked Deck of Cards cascading to the bottom-right of the cursor */}
              {activeDragData.people.slice(0, 5).map((person, idx, visibleStack) => {
                const isTopCard = idx === 0
                return (
                  <div
                    key={person.id}
                    className="px-3 py-2 rounded border shadow-xl flex items-center gap-2 text-xs min-w-[230px]"
                    style={{
                      position: isTopCard ? 'relative' : 'absolute',
                      top: `${idx * 7}px`,
                      left: `${idx * 7}px`,
                      zIndex: visibleStack.length - idx,
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: isTopCard
                        ? 'var(--accent-primary)'
                        : 'var(--border-strong)',
                      color: 'var(--text-primary)',
                      opacity: isTopCard ? 1 : Math.max(0.55, 0.92 - idx * 0.12)
                    }}
                  >
                    <GripVertical className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold break-words leading-snug flex items-center justify-between gap-2">
                        <span>{person.name}</span>
                        {isTopCard && activeDragData.people.length > 1 && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white tabular-nums shrink-0"
                            style={{ backgroundColor: 'var(--accent-primary)' }}
                          >
                            {activeDragData.people.length} Cards
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[10px] tabular-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {person.role} · {person.hoursPerDay}h/d — Drop onto project
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeDragData?.type === 'deck-project' && (
            <div
              className="px-3 py-2 rounded border shadow-lg flex items-center gap-2 text-xs pointer-events-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: activeDragData.project.color,
                color: 'var(--text-primary)'
              }}
            >
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: activeDragData.project.color }}
              />
              <div>
                <div className="font-semibold break-words">{activeDragData.project.name}</div>
                <div
                  className="text-[10px] tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {activeDragData.project.startDate} → {activeDragData.project.endDate} —
                  Drop onto Timeline
                </div>
              </div>
            </div>
          )}
        </DragOverlay>

        {/* Background Update Notification Pill */}
        {updateBanner && (
          <div
            className="fixed bottom-3 right-4 z-50 px-3 py-1.5 rounded border shadow-lg flex items-center gap-2 text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <ArrowDownCircle
              className="w-4 h-4"
              style={{ color: 'var(--accent-primary)' }}
            />
            {updateBanner.status === 'downloading' ? (
              <span>Downloading update v{updateBanner.version}...</span>
            ) : (
              <>
                <span>Update v{updateBanner.version} ready.</span>
                <button
                  onClick={() => void window.rdeck?.quitAndInstallUpdate()}
                  className="px-2 py-0.5 rounded font-medium text-white"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  Restart
                </button>
              </>
            )}
          </div>
        )}

        <ModalsContainer />
      </div>
    </DndContext>
  )
}
