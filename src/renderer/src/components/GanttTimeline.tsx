import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import {
  Plus,
  X,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Eye,
  EyeOff,
  Calendar,
  Users
} from 'lucide-react'
import {
  addBusinessDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth
} from 'date-fns'
import { useDeckStore } from '../store/useDeckStore'
import type { AllocationMode, Dependency, Project } from '../../../shared/types'
import {
  buildHolidayWeekdaySet,
  computeProjectTotalFinancials,
  getHorizonMonths,
  parseLocalDate,
  toIsoDate
} from '../../../shared/engine/calculator'
import {
  formatDollarCompact,
  formatDollarWhole
} from '../../../shared/engine/formatters'

/**
 * Computes the exact business-day shift required so a dependent project starts
 * on the first working weekday strictly after its prerequisite's endDate.
 */
function computeClashResolutionShift(
  projectStartIso: string,
  projectEndIso: string,
  predEndIso: string,
  holidaySet: Set<string>
): { deltaBusinessDays: number; newStartDate: string; newEndDate: string } {
  const start = parseLocalDate(projectStartIso)
  const end = parseLocalDate(projectEndIso)
  let delta = 1
  while (delta < 1500) {
    const candidateStart = toIsoDate(addBusinessDays(start, delta))
    if (candidateStart > predEndIso && !holidaySet.has(candidateStart)) {
      const candidateEnd = toIsoDate(addBusinessDays(end, delta))
      return {
        deltaBusinessDays: delta,
        newStartDate: candidateStart,
        newEndDate: candidateEnd
      }
    }
    delta++
  }
  return {
    deltaBusinessDays: 1,
    newStartDate: toIsoDate(addBusinessDays(start, 1)),
    newEndDate: toIsoDate(addBusinessDays(end, 1))
  }
}

/**
 * Orders timeline projects so dependent projects (fromProjectId -> toProjectId)
 * are placed on adjacent lines right next to each other while keeping each project on its own row.
 */
function orderTimelineProjectsWithAdjacentDependencies(
  projects: Project[],
  dependencies: Dependency[]
): Project[] {
  if (projects.length <= 1) return projects
  const byId = new Map(projects.map((p) => [p.id, p]))
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()

  for (const dep of dependencies) {
    if (!byId.has(dep.fromProjectId) || !byId.has(dep.toProjectId)) continue
    if (dep.fromProjectId === dep.toProjectId) continue
    const outList = outgoing.get(dep.fromProjectId) || []
    if (!outList.includes(dep.toProjectId)) outList.push(dep.toProjectId)
    outgoing.set(dep.fromProjectId, outList)

    const inList = incoming.get(dep.toProjectId) || []
    if (!inList.includes(dep.fromProjectId)) inList.push(dep.fromProjectId)
    incoming.set(dep.toProjectId, inList)
  }

  for (const [, list] of outgoing) {
    list.sort((a, b) => {
      const pa = byId.get(a)!
      const pb = byId.get(b)!
      return pa.startDate.localeCompare(pb.startDate) || pa.priorityRank - pb.priorityRank
    })
  }

  const baseSorted = [...projects].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.priorityRank - b.priorityRank
  )

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: Project[] = []

  const placeChain = (projId: string): void => {
    if (visited.has(projId) || visiting.has(projId)) return
    const proj = byId.get(projId)
    if (!proj) return
    visiting.add(projId)

    // Place unvisited prerequisites immediately above
    const preds = incoming.get(projId) || []
    for (const predId of preds) {
      if (!visited.has(predId) && !visiting.has(predId)) {
        placeChain(predId)
      }
    }

    if (!visited.has(projId)) {
      visited.add(projId)
      ordered.push(proj)
    }
    visiting.delete(projId)

    // Place direct dependents on the very next row(s)
    const succs = outgoing.get(projId) || []
    for (const succId of succs) {
      if (!visited.has(succId)) {
        placeChain(succId)
      }
    }
  }

  for (const p of baseSorted) {
    if (!visited.has(p.id)) {
      placeChain(p.id)
    }
  }

  return ordered
}

interface GanttTimelineProps {
  heightPercent: number
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({ heightPercent }) => {
  const {
    dataset,
    baselineDataset,
    isPresentationMode,
    showGhostBars,
    zoomMonths,
    focusedProjectId,
    selectedProjectForPopover,
    pendingDropAssignment,
    setShowGhostBars,
    setZoomMonths,
    setFocusedProjectId,
    setSelectedProjectForPopover,
    setPendingDropAssignment,
    clearSelectedPeople,
    moveProjectStatus,
    shiftProjectByBusinessDays,
    upsertMultipleAssignments
  } = useDeckStore()

  const { setNodeRef: setTimelineDropRef, isOver: isOverTimeline } = useDroppable({
    id: 'gantt-timeline-dropzone',
    data: { type: 'timeline-canvas' }
  })

  const [dragInteraction, setDragInteraction] = useState<{
    projectId: string
    mode: 'move' | 'resize-start' | 'resize-end'
    initialClientX: number
    deltaDaysPreview: number
  } | null>(null)

  // Multi-person or single-person quick assignment state
  const [batchAssignMode, setBatchAssignMode] = useState<AllocationMode>('total_hours')
  const [batchAssignValue, setBatchAssignValue] = useState<string>('40')
  const [perPersonValues, setPerPersonValues] = useState<
    Record<string, { mode: AllocationMode; value: string }>
  >({})

  useEffect(() => {
    if (!pendingDropAssignment) return
    const initialMap: Record<string, { mode: AllocationMode; value: string }> = {}
    for (const pid of pendingDropAssignment.personIds) {
      const existing = dataset.assignments.find(
        (a) => a.projectId === pendingDropAssignment.projectId && a.personId === pid
      )
      initialMap[pid] = {
        mode: existing?.allocationMode ?? 'total_hours',
        value: existing ? String(existing.allocationValue) : '40'
      }
    }
    setBatchAssignMode('total_hours')
    setBatchAssignValue('40')
    setPerPersonValues(initialMap)
  }, [pendingDropAssignment, dataset.assignments])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1000)

  // Track container width dynamically with ResizeObserver so timeline stretches to window width
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const updateSize = (): void => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth)
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pendingDropAssignment) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setPendingDropAssignment(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingDropAssignment, setPendingDropAssignment])

  const horizon = useMemo(() => getHorizonMonths(dataset), [dataset])
  const holidaySet = useMemo(
    () => buildHolidayWeekdaySet(dataset.holidays),
    [dataset.holidays]
  )
  const peopleMap = useMemo(
    () => new Map(dataset.people.map((p) => [p.id, p])),
    [dataset.people]
  )
  const baselineProjectMap = useMemo(
    () => new Map(baselineDataset.projects.map((p) => [p.id, p])),
    [baselineDataset.projects]
  )

  const timelineProjects = useMemo(
    () =>
      orderTimelineProjectsWithAdjacentDependencies(
        dataset.projects.filter((p) => p.status === 'timeline'),
        dataset.dependencies
      ),
    [dataset.projects, dataset.dependencies]
  )

  const firstMonth = horizon[0]
  const lastMonth = horizon[horizon.length - 1]
  const timelineStart = useMemo(
    () => startOfMonth(new Date(firstMonth.year, firstMonth.month - 1, 1)),
    [firstMonth]
  )
  const timelineEnd = useMemo(
    () => endOfMonth(new Date(lastMonth.year, lastMonth.month - 1, 1)),
    [lastMonth]
  )
  const totalCalendarDays = Math.max(
    1,
    differenceInCalendarDays(timelineEnd, timelineStart) + 1
  )

  // Responsive month column width: fills the available window width at zoom=1, or expands when zoomed in
  const baseMonthWidth = Math.max(88, Math.floor(containerWidth / Math.max(1, horizon.length)))
  const monthWidthPx = Math.round(baseMonthWidth * zoomMonths)
  const totalCanvasWidthPx = Math.max(containerWidth, horizon.length * monthWidthPx)
  const pixelsPerCalendarDay = totalCanvasWidthPx / totalCalendarDays
  const pixelsPerBusinessDay = pixelsPerCalendarDay * 1.4

  const getDateOffsetPercent = (isoDate: string): number => {
    const dt = parseLocalDate(isoDate)
    const daysFromStart = differenceInCalendarDays(dt, timelineStart)
    return Math.max(0, Math.min(100, (daysFromStart / totalCalendarDays) * 100))
  }

  const getSpanPercent = (startIso: string, endIso: string): { left: number; width: number } => {
    const s = parseLocalDate(startIso)
    const e = parseLocalDate(endIso)
    const startOffset = differenceInCalendarDays(s, timelineStart)
    const spanDays = Math.max(2, differenceInCalendarDays(e, s) + 1)
    const left = Math.max(0, Math.min(99, (startOffset / totalCalendarDays) * 100))
    const width = Math.max(1.2, Math.min(100 - left, (spanDays / totalCalendarDays) * 100))
    return { left, width }
  }

  const startBarPointerDrag = (
    e: React.PointerEvent,
    projectId: string,
    mode: 'move' | 'resize-start' | 'resize-end'
  ): void => {
    if (isPresentationMode) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX

    let lastDeltaBizDays = 0
    setDragInteraction({
      projectId,
      mode,
      initialClientX: startX,
      deltaDaysPreview: 0
    })

    const onPointerMove = (moveEvt: PointerEvent): void => {
      const dx = moveEvt.clientX - startX
      const deltaBizDays = Math.round(dx / Math.max(2, pixelsPerBusinessDay))
      if (deltaBizDays === lastDeltaBizDays) return
      lastDeltaBizDays = deltaBizDays
      setDragInteraction({
        projectId,
        mode,
        initialClientX: startX,
        deltaDaysPreview: deltaBizDays
      })
    }

    const onPointerUp = (upEvt: PointerEvent): void => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      const dx = upEvt.clientX - startX
      const deltaBizDays = Math.round(dx / Math.max(2, pixelsPerBusinessDay))
      setDragInteraction(null)
      if (deltaBizDays !== 0) {
        shiftProjectByBusinessDays(projectId, deltaBizDays, mode, false)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleConfirmDropAssignment = (): void => {
    if (!pendingDropAssignment) return
    const entries = pendingDropAssignment.personIds
      .map((pid) => {
        const person = peopleMap.get(pid)
        if (!person) return null
        const cfg = perPersonValues[pid] ?? {
          mode: batchAssignMode,
          value: batchAssignValue
        }
        return {
          personId: pid,
          allocationValue: Math.max(0, Number(cfg.value) || 0),
          allocationMode: cfg.mode,
          requiredRole: person.role,
          requiredSkills: person.skills
        }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))

    upsertMultipleAssignments(pendingDropAssignment.projectId, entries)
    setPendingDropAssignment(null)
    clearSelectedPeople()
  }

  const isWhatIf = !dataset.scenario.isBaseline

  return (
    <section
      ref={setTimelineDropRef}
      className={`flex flex-col relative overflow-hidden transition-colors ${
        heightPercent >= 100 ? 'flex-1 min-h-0' : 'shrink-0'
      }`}
      style={{
        height: heightPercent >= 100 ? undefined : `${heightPercent}%`,
        minHeight: '160px',
        backgroundColor: isOverTimeline ? 'var(--bg-hover)' : 'var(--bg-canvas)'
      }}
    >
      {/* Timeline Sub-Header Controls */}
      <div
        className="h-8 px-3 border-b flex items-center justify-between shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            Timeline ({timelineProjects.length})
          </span>
          {!isPresentationMode && (
            <span
              className="text-[11px] truncate hidden sm:inline"
              style={{ color: 'var(--text-muted)' }}
            >
              Hover any bar for full details · Drag bars to shift · Drop people onto bars
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isWhatIf && (
            <button
              onClick={() => setShowGhostBars(!showGhostBars)}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors"
              style={{
                backgroundColor: showGhostBars ? 'var(--bg-elevated)' : 'transparent',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
              title="Toggle Baseline Ghost Bars"
            >
              {showGhostBars ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              <span>Baseline Ghost</span>
            </button>
          )}

          {/* Zoom Slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Zoom
            </span>
            <ZoomOut
              className="w-3 h-3 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setZoomMonths(Math.max(1, Number((zoomMonths - 0.2).toFixed(2))))}
            />
            <input
              type="range"
              min="1"
              max="2.4"
              step="0.05"
              value={zoomMonths}
              onChange={(e) => setZoomMonths(Number(e.target.value))}
              className="w-16 cursor-pointer h-1"
              title="Zoom Timeline Horizon"
            />
            <ZoomIn
              className="w-3 h-3 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setZoomMonths(Math.min(2.4, Number((zoomMonths + 0.2).toFixed(2))))}
            />
          </div>
        </div>
      </div>

      {/* Main Scrollable Gantt Canvas */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative">
        <div
          style={{ width: `${totalCanvasWidthPx}px`, minHeight: '100%' }}
          className="relative flex flex-col pb-16"
        >
          {/* Sticky Month Header Bar */}
          <div
            className="sticky top-0 z-20 flex h-7 border-b"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            {horizon.map((m) => (
              <div
                key={m.yearMonth}
                style={{
                  width: `${totalCanvasWidthPx / horizon.length}px`,
                  borderColor: 'var(--border-subtle)'
                }}
                className="border-r px-2 flex items-center text-[11px] font-medium shrink-0 tabular-nums"
              >
                <span>{format(new Date(m.year, m.month - 1, 1), 'MMM yyyy')}</span>
              </div>
            ))}
          </div>

          {/* Background Month Grid Columns */}
          <div className="absolute inset-0 top-7 flex pointer-events-none">
            {horizon.map((m) => (
              <div
                key={m.yearMonth}
                style={{
                  width: `${totalCanvasWidthPx / horizon.length}px`,
                  borderColor: 'var(--border-subtle)'
                }}
                className="border-r h-full opacity-60 shrink-0"
              />
            ))}
          </div>

          {/* Empty State Tooltip */}
          {timelineProjects.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 z-10">
              <div
                className="max-w-sm rounded border p-4 text-center"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <p className="text-xs font-semibold">
                  Start by adding a project and dragging it onto the timeline
                </p>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Projects in <strong>Projects on Deck</strong> do not factor into the
                  Capacity or Budget charts until placed here.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-10 py-2.5 space-y-2">
              {/* SVG Dependency Connector Lines Layer (Routes cleanly between adjacent dependent rows) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible"
                aria-hidden="true"
              >
                {dataset.dependencies.map((dep) => {
                  const fromIdx = timelineProjects.findIndex(
                    (p) => p.id === dep.fromProjectId
                  )
                  const toIdx = timelineProjects.findIndex(
                    (p) => p.id === dep.toProjectId
                  )
                  if (fromIdx === -1 || toIdx === -1) return null

                  const fromProj = timelineProjects[fromIdx]
                  const toProj = timelineProjects[toIdx]

                  const fromSpan = getSpanPercent(fromProj.startDate, fromProj.endDate)
                  const toSpan = getSpanPercent(toProj.startDate, toProj.endDate)

                  const fromDragPx =
                    dragInteraction?.projectId === fromProj.id &&
                    (dragInteraction.mode === 'move' ||
                      dragInteraction.mode === 'resize-end')
                      ? dragInteraction.deltaDaysPreview * pixelsPerBusinessDay
                      : 0

                  const toDragPx =
                    dragInteraction?.projectId === toProj.id &&
                    (dragInteraction.mode === 'move' ||
                      dragInteraction.mode === 'resize-start')
                      ? dragInteraction.deltaDaysPreview * pixelsPerBusinessDay
                      : 0

                  const x1 =
                    ((fromSpan.left + fromSpan.width) / 100) * totalCanvasWidthPx +
                    fromDragPx
                  const y1 = 28 + fromIdx * 44
                  const x2 = (toSpan.left / 100) * totalCanvasWidthPx + toDragPx
                  const y2 = 28 + toIdx * 44

                  const isClash = fromProj.endDate > toProj.startDate
                  const strokeColor = isClash
                    ? 'var(--status-overrun)'
                    : 'var(--accent-primary)'

                  // Route along the gap between the rows so the connector line never cuts through bars
                  const midY =
                    Math.abs(toIdx - fromIdx) === 1
                      ? (y1 + y2) / 2
                      : y1 < y2
                        ? y1 + 22
                        : y1 - 22
                  const stepOutX = x1 + 10
                  const stepInX = x2 - 10
                  const pathD = `M ${x1} ${y1} L ${stepOutX} ${y1} L ${stepOutX} ${midY} L ${stepInX} ${midY} L ${stepInX} ${y2} L ${x2} ${y2}`

                  return (
                    <g key={dep.id}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isClash ? 2 : 1.75}
                        strokeDasharray={isClash ? '4 2.5' : undefined}
                        opacity={isClash ? 0.95 : 0.78}
                      />
                      {/* Origin node at predecessor end */}
                      <rect
                        x={x1 - 2.5}
                        y={y1 - 2.5}
                        width={5}
                        height={5}
                        fill={strokeColor}
                      />
                      {/* Arrowhead pointing into successor start */}
                      <polygon
                        points={`${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`}
                        fill={strokeColor}
                      />
                    </g>
                  )
                })}
              </svg>

              {timelineProjects.map((project) => {
                const { left, width } = getSpanPercent(project.startDate, project.endDate)
                const baselineProj = baselineProjectMap.get(project.id)
                const hasMovedVsBaseline =
                  isWhatIf &&
                  showGhostBars &&
                  baselineProj &&
                  (baselineProj.startDate !== project.startDate ||
                    baselineProj.endDate !== project.endDate)

                const ghostSpan =
                  hasMovedVsBaseline && baselineProj
                    ? getSpanPercent(baselineProj.startDate, baselineProj.endDate)
                    : null

                const fin = computeProjectTotalFinancials(
                  project,
                  dataset.assignments,
                  peopleMap,
                  holidaySet
                )
                const projectAssignments = dataset.assignments.filter(
                  (a) => a.projectId === project.id
                )
                const projectMilestones = dataset.milestones.filter(
                  (m) => m.projectId === project.id
                )

                const collidingPredecessors = dataset.dependencies
                  .filter((d) => d.toProjectId === project.id)
                  .map((d) => timelineProjects.find((tp) => tp.id === d.fromProjectId))
                  .filter(
                    (pred): pred is Project =>
                      Boolean(pred) && pred!.endDate > project.startDate
                  )

                const allPredecessors = dataset.dependencies
                  .filter((d) => d.toProjectId === project.id)
                  .map((d) => timelineProjects.find((tp) => tp.id === d.fromProjectId))
                  .filter((pred): pred is Project => Boolean(pred))

                const allSuccessors = dataset.dependencies
                  .filter((d) => d.fromProjectId === project.id)
                  .map((d) => timelineProjects.find((tp) => tp.id === d.toProjectId))
                  .filter((succ): succ is Project => Boolean(succ))

                const isBeingDragged = dragInteraction?.projectId === project.id
                const dragOffsetPx = isBeingDragged
                  ? dragInteraction.deltaDaysPreview * pixelsPerBusinessDay
                  : 0

                return (
                  <TimelineProjectRow
                    key={project.id}
                    project={project}
                    leftPercent={left}
                    widthPercent={width}
                    ghostSpan={ghostSpan}
                    baselineProj={baselineProj}
                    totalCost={fin.totalCost}
                    totalHours={fin.totalHours}
                    assignedPeopleFullNames={projectAssignments.map(
                      (a) => peopleMap.get(a.personId)?.name || 'TBD'
                    )}
                    milestones={projectMilestones}
                    getDateOffsetPercent={getDateOffsetPercent}
                    collidingPredecessors={collidingPredecessors}
                    allPredecessors={allPredecessors}
                    allSuccessors={allSuccessors}
                    holidaySet={holidaySet}
                    isFocused={focusedProjectId === project.id}
                    isPopoverOpen={selectedProjectForPopover === project.id}
                    isPresentationMode={isPresentationMode}
                    dragMode={isBeingDragged ? dragInteraction.mode : null}
                    dragOffsetPx={dragOffsetPx}
                    dragDeltaDays={isBeingDragged ? dragInteraction.deltaDaysPreview : 0}
                    onStartDrag={(e, mode) => startBarPointerDrag(e, project.id, mode)}
                    onTogglePopover={() => {
                      setSelectedProjectForPopover(
                        selectedProjectForPopover === project.id ? null : project.id
                      )
                      setFocusedProjectId(project.id)
                    }}
                    onSendBackToDeck={() => {
                      if (selectedProjectForPopover === project.id) {
                        setSelectedProjectForPopover(null)
                      }
                      moveProjectStatus(project.id, 'on_deck')
                    }}
                    onAutoResolveClash={(pred) => {
                      const shift = computeClashResolutionShift(
                        project.startDate,
                        project.endDate,
                        pred.endDate,
                        holidaySet
                      )
                      shiftProjectByBusinessDays(
                        project.id,
                        shift.deltaBusinessDays,
                        'move',
                        false
                      )
                    }}
                    onNudgeDays={(deltaBizDays) => {
                      shiftProjectByBusinessDays(project.id, deltaBizDays, 'move', false)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Person & Single-Person Assignment Modal (When dragging 1 or more People onto a Project bar) */}
      {pendingDropAssignment && (
        <div
          onClick={() => setPendingDropAssignment(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assign resources to project"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-md border p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)'
            }}
          >
            {(() => {
              const project = dataset.projects.find(
                (p) => p.id === pendingDropAssignment.projectId
              )
              const peopleList = pendingDropAssignment.personIds
                .map((id) => peopleMap.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p))

              if (!project || peopleList.length === 0) return null

              return (
                <>
                  <div
                    className="flex items-start justify-between border-b pb-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div>
                      <h3 className="font-editorial text-base font-semibold">
                        {peopleList.length === 1
                          ? `Assign ${peopleList[0].name}`
                          : `Assign ${peopleList.length} Resources`}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        to <strong>{project.name}</strong> ({project.startDate} →{' '}
                        {project.endDate})
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingDropAssignment(null)}
                      aria-label="Close assignment dialog"
                      className="p-1 rounded hover:opacity-75"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Batch Apply Row when multiple people are being assigned */}
                  {peopleList.length > 1 && (
                    <div
                      className="p-3 rounded border space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)'
                      }}
                    >
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Quick Apply to All {peopleList.length} Selected Resources
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-6">
                          <label
                            className="text-[11px] block mb-1"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Mode
                          </label>
                          <select
                            value={batchAssignMode}
                            onChange={(e) => {
                              const nextMode = e.target.value as AllocationMode
                              setBatchAssignMode(nextMode)
                              setPerPersonValues((prev) => {
                                const updated = { ...prev }
                                for (const p of peopleList) {
                                  updated[p.id] = {
                                    mode: nextMode,
                                    value: updated[p.id]?.value ?? batchAssignValue
                                  }
                                }
                                return updated
                              })
                            }}
                            className="w-full px-2.5 py-1.5 rounded border text-xs"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <option value="total_hours">Fixed Total Hours</option>
                            <option value="hours_per_day">Hours / Day (Scales)</option>
                            <option value="percent">% Capacity (Scales)</option>
                          </select>
                        </div>
                        <div className="col-span-6">
                          <label
                            className="text-[11px] block mb-1"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {batchAssignMode === 'total_hours'
                              ? 'Total Hours Each'
                              : batchAssignMode === 'hours_per_day'
                                ? 'Hours / Day Each'
                                : 'Allocation % Each'}
                          </label>
                          <input
                            type="number"
                            value={batchAssignValue}
                            onChange={(e) => {
                              const val = e.target.value
                              setBatchAssignValue(val)
                              setPerPersonValues((prev) => {
                                const updated = { ...prev }
                                for (const p of peopleList) {
                                  updated[p.id] = {
                                    mode: updated[p.id]?.mode ?? batchAssignMode,
                                    value: val
                                  }
                                }
                                return updated
                              })
                            }}
                            className="w-full px-2.5 py-1.5 rounded border text-xs font-semibold tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Individual Resource Allocation Rows */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {peopleList.map((person, idx) => {
                      const cfg = perPersonValues[person.id] ?? {
                        mode: batchAssignMode,
                        value: batchAssignValue
                      }
                      return (
                        <div
                          key={person.id}
                          className="p-2.5 rounded border grid grid-cols-12 gap-2 items-center"
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            borderColor: 'var(--border-subtle)'
                          }}
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="text-xs font-semibold break-words leading-snug">
                              {person.name}
                            </div>
                            <div
                              className="text-[10px] tabular-nums"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {person.role} · {person.hoursPerDay}h/d
                            </div>
                          </div>

                          <div className="col-span-4">
                            <select
                              aria-label={`Allocation mode for ${person.name}`}
                              value={cfg.mode}
                              onChange={(e) =>
                                setPerPersonValues((prev) => ({
                                  ...prev,
                                  [person.id]: {
                                    ...cfg,
                                    mode: e.target.value as AllocationMode
                                  }
                                }))
                              }
                              className="w-full px-2 py-1.5 rounded border text-xs"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)'
                              }}
                            >
                              <option value="total_hours">Total Hours</option>
                              <option value="hours_per_day">Hours / Day</option>
                              <option value="percent">% Capacity</option>
                            </select>
                          </div>

                          <div className="col-span-3">
                            <input
                              type="number"
                              autoFocus={idx === 0}
                              aria-label={`Allocation value for ${person.name}`}
                              value={cfg.value}
                              onChange={(e) =>
                                setPerPersonValues((prev) => ({
                                  ...prev,
                                  [person.id]: {
                                    ...cfg,
                                    value: e.target.value
                                  }
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleConfirmDropAssignment()
                                }
                              }}
                              className="w-full px-2.5 py-1.5 rounded border text-xs font-semibold tabular-nums text-right"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      onClick={() => setPendingDropAssignment(null)}
                      className="px-3.5 py-1.5 rounded border text-xs font-medium"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDropAssignment}
                      className="px-4 py-1.5 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {peopleList.length === 1
                        ? 'Assign Resource'
                        : `Assign ${peopleList.length} Resources`}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </section>
  )
}

interface TimelineProjectRowProps {
  project: Project
  leftPercent: number
  widthPercent: number
  ghostSpan: { left: number; width: number } | null
  baselineProj?: Project
  totalCost: number
  totalHours: number
  assignedPeopleFullNames: string[]
  milestones: { id: string; name: string; targetDate: string; color: string }[]
  getDateOffsetPercent: (isoDate: string) => number
  collidingPredecessors: Project[]
  allPredecessors: Project[]
  allSuccessors: Project[]
  holidaySet: Set<string>
  isFocused: boolean
  isPopoverOpen: boolean
  isPresentationMode: boolean
  dragMode: 'move' | 'resize-start' | 'resize-end' | null
  dragOffsetPx: number
  dragDeltaDays: number
  onStartDrag: (
    e: React.PointerEvent,
    mode: 'move' | 'resize-start' | 'resize-end'
  ) => void
  onTogglePopover: () => void
  onSendBackToDeck: () => void
  onAutoResolveClash: (predecessor: Project) => void
  onNudgeDays: (deltaBizDays: number) => void
}

const TimelineProjectRow: React.FC<TimelineProjectRowProps> = ({
  project,
  leftPercent,
  widthPercent,
  ghostSpan,
  baselineProj,
  totalCost,
  totalHours,
  assignedPeopleFullNames,
  milestones,
  getDateOffsetPercent,
  collidingPredecessors,
  allPredecessors,
  allSuccessors,
  holidaySet,
  isFocused,
  isPresentationMode,
  dragMode,
  dragOffsetPx,
  dragDeltaDays,
  onStartDrag,
  onTogglePopover,
  onSendBackToDeck,
  onAutoResolveClash,
  onNudgeDays
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isClashHovered, setIsClashHovered] = useState(false)
  const [isClashPinned, setIsClashPinned] = useState(false)
  const [confirmingClashPredId, setConfirmingClashPredId] = useState<string | null>(null)
  const barWrapperRef = useRef<HTMLDivElement | null>(null)
  const clashBadgeRef = useRef<HTMLButtonElement | null>(null)
  const hoverCardRef = useRef<HTMLDivElement | null>(null)
  const clashCardRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const clashCloseTimerRef = useRef<number | null>(null)

  const isClashPanelOpen = isClashHovered || isClashPinned

  const [cardPos, setCardPos] = useState<{ left: number; top: number }>({
    left: 200,
    top: 120
  })
  const [clashCardPos, setClashCardPos] = useState<{ left: number; top: number }>({
    left: 200,
    top: 120
  })

  const { setNodeRef: setProjectDropRef, isOver: isPersonOverBar } = useDroppable({
    id: `timeline-project::${project.id}`,
    data: {
      type: 'timeline-project',
      project
    }
  })

  const openHoverCard = (): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setIsHovered(true)
  }

  const scheduleCloseHoverCard = (): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsHovered(false)
      closeTimerRef.current = null
    }, 110)
  }

  const openClashCard = (): void => {
    if (clashCloseTimerRef.current !== null) {
      window.clearTimeout(clashCloseTimerRef.current)
      clashCloseTimerRef.current = null
    }
    setIsClashHovered(true)
  }

  const scheduleCloseClashCard = (): void => {
    if (isClashPinned || confirmingClashPredId !== null) return
    if (clashCloseTimerRef.current !== null) {
      window.clearTimeout(clashCloseTimerRef.current)
    }
    clashCloseTimerRef.current = window.setTimeout(() => {
      setIsClashHovered(false)
      clashCloseTimerRef.current = null
    }, 150)
  }

  const closeClashPanelCompletely = (): void => {
    if (clashCloseTimerRef.current !== null) {
      window.clearTimeout(clashCloseTimerRef.current)
      clashCloseTimerRef.current = null
    }
    setIsClashHovered(false)
    setIsClashPinned(false)
    setConfirmingClashPredId(null)
  }

  useEffect(() => {
    if (!isClashPinned && confirmingClashPredId === null) return
    const onPointerDownOutside = (e: MouseEvent): void => {
      const target = e.target as Node
      if (
        clashCardRef.current?.contains(target) ||
        clashBadgeRef.current?.contains(target)
      ) {
        return
      }
      closeClashPanelCompletely()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeClashPanelCompletely()
      }
    }
    window.addEventListener('mousedown', onPointerDownOutside)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDownOutside)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isClashPinned, confirmingClashPredId])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
      if (clashCloseTimerRef.current !== null) {
        window.clearTimeout(clashCloseTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    if (!isHovered || !barWrapperRef.current) return
    const barRect = barWrapperRef.current.getBoundingClientRect()
    const cardWidth = 380
    const cardHeight = hoverCardRef.current?.getBoundingClientRect().height ?? 220
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 12

    let left = barRect.left
    if (left + cardWidth > vw - pad) {
      left = Math.max(pad, vw - cardWidth - pad)
    }
    if (left < pad) {
      left = pad
    }

    let top = barRect.bottom + 6
    if (top + cardHeight > vh - pad) {
      top = Math.max(pad, barRect.top - cardHeight - 6)
    }

    setCardPos({ left, top })
  }, [
    isHovered,
    leftPercent,
    widthPercent,
    assignedPeopleFullNames.length,
    collidingPredecessors.length
  ])

  useLayoutEffect(() => {
    if (!isClashPanelOpen) return
    const anchorEl = clashBadgeRef.current || barWrapperRef.current
    if (!anchorEl) return
    const anchorRect = anchorEl.getBoundingClientRect()
    const cardWidth = 380
    const cardHeight = clashCardRef.current?.getBoundingClientRect().height ?? 230
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 12

    let left = anchorRect.left
    if (left + cardWidth > vw - pad) {
      left = Math.max(pad, vw - cardWidth - pad)
    }
    if (left < pad) {
      left = pad
    }

    let top = anchorRect.bottom + 8
    if (top + cardHeight > vh - pad) {
      top = Math.max(pad, anchorRect.top - cardHeight - 8)
    }

    setClashCardPos({ left, top })
  }, [
    isClashPanelOpen,
    confirmingClashPredId,
    collidingPredecessors.length,
    leftPercent
  ])

  const isTentative = project.certainty === 'tentative'

  const computedLeft =
    dragMode === 'resize-start'
      ? `calc(${leftPercent}% + ${dragOffsetPx}px)`
      : `${leftPercent}%`

  const computedWidth =
    dragMode === 'resize-end'
      ? `max(24px, calc(${widthPercent}% + ${dragOffsetPx}px))`
      : dragMode === 'resize-start'
        ? `max(24px, calc(${widthPercent}% - ${dragOffsetPx}px))`
        : `${widthPercent}%`

  const isShortBarNearRightEdge = widthPercent < 20 && leftPercent > 78

  return (
    <div
      className={`relative h-9 flex items-center group ${
        isHovered || isClashPanelOpen ? 'z-30' : 'z-10'
      }`}
    >
      {/* Baseline Ghost Bar */}
      {ghostSpan && baselineProj && (
        <div
          style={{
            left: `${ghostSpan.left}%`,
            width: `${ghostSpan.width}%`,
            borderColor: 'var(--border-strong)'
          }}
          className="absolute h-7 rounded border border-dashed opacity-60 pointer-events-none flex items-center px-2 text-[10px] whitespace-nowrap"
          title={`Baseline: ${baselineProj.startDate} → ${baselineProj.endDate}`}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Baseline: {baselineProj.startDate.slice(5)}–{baselineProj.endDate.slice(5)}
          </span>
        </div>
      )}

      {/* Active Project Bar — Always shows Project Name clearly even on short durations */}
      <div
        ref={(node) => {
          setProjectDropRef(node)
          barWrapperRef.current = node
        }}
        onMouseEnter={openHoverCard}
        onMouseLeave={scheduleCloseHoverCard}
        style={{
          left: computedLeft,
          width: computedWidth,
          transform:
            dragMode === 'move' ? `translateX(${dragOffsetPx}px)` : undefined,
          backgroundColor: isPersonOverBar
            ? 'var(--status-optimal-bg)'
            : 'var(--bg-surface)',
          borderColor: isPersonOverBar
            ? 'var(--status-optimal)'
            : collidingPredecessors.length > 0
              ? 'var(--status-overrun)'
              : isFocused || isHovered
                ? 'var(--accent-primary)'
                : 'var(--border-strong)'
        }}
        className={`absolute h-8 rounded border flex items-center justify-between px-2 select-none transition-colors overflow-visible ${
          isTentative ? 'border-dashed' : ''
        }`}
      >
        {/* Left Resize Handle */}
        <div
          onPointerDown={(e) => onStartDrag(e, 'resize-start')}
          style={{ backgroundColor: project.color }}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:w-2 transition-all z-20"
          title="Drag left edge to change Start Date"
        />

        {/* Draggable & Keyboard-Focusable Bar Content — Project Name is NEVER cut off */}
        <div
          tabIndex={0}
          role="button"
          aria-label={`${project.name}, ${project.startDate} to ${project.endDate}, ${formatDollarWhole(totalCost)}, ${Math.round(totalHours)} hours. Press Enter to inspect or Left/Right arrows to shift schedule.`}
          onPointerDown={(e) => onStartDrag(e, 'move')}
          onDoubleClick={onTogglePopover}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onTogglePopover()
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              onNudgeDays(-1)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              onNudgeDays(1)
            }
          }}
          className={`flex-1 flex items-center gap-2 cursor-grab active:cursor-grabbing rounded-xs overflow-visible ${
            isShortBarNearRightEdge ? 'justify-end' : 'justify-between'
          }`}
        >
          {/* Always-visible Project Name Label (extends cleanly if bar is short so name is never truncated) */}
          <div
            className="flex items-center gap-1.5 whitespace-nowrap px-1 py-0.5 rounded-xs"
            style={{
              backgroundColor:
                widthPercent < 14 ? 'var(--bg-surface)' : 'transparent',
              boxShadow:
                widthPercent < 14 ? '0 1px 2px rgba(0,0,0,0.06)' : undefined
            }}
          >
            <span
              className="w-2.5 h-2.5 shrink-0"
              style={{ backgroundColor: project.color }}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold">{project.name}</span>
            {isTentative && (
              <span
                className="text-[9px] uppercase px-1 rounded-xs border shrink-0"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-muted)'
                }}
              >
                Tentative
              </span>
            )}
            {collidingPredecessors.length > 0 && (
              <button
                ref={clashBadgeRef}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) => {
                  e.stopPropagation()
                  openClashCard()
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation()
                  scheduleCloseClashCard()
                }}
                onFocus={(e) => {
                  e.stopPropagation()
                  openClashCard()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsHovered(false)
                  setIsClashPinned((prev) => !prev)
                  openClashCard()
                }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-xs border font-semibold shrink-0 cursor-pointer"
                style={{
                  borderColor: 'var(--status-overrun)',
                  color: 'var(--status-overrun)',
                  backgroundColor: 'var(--status-overrun-bg)'
                }}
                aria-expanded={isClashPanelOpen}
                aria-label={`Dependency clash with ${collidingPredecessors[0].name}. Hover or click to inspect clash details.`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Clash
              </button>
            )}
          </div>

          {/* Only show inline summary inside the resting bar when the bar has generous width (>= 22% of horizon) */}
          {widthPercent >= 22 && (
            <div className="hidden md:flex items-center gap-2 shrink-0 text-[11px] tabular-nums pr-1">
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                {formatDollarCompact(totalCost)}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {Math.round(totalHours)}h
              </span>
            </div>
          )}
        </div>

        {dragDeltaDays !== 0 && (
          <div
            className="ml-1.5 px-1.5 py-0.2 rounded-xs text-[10px] font-semibold text-white tabular-nums shrink-0 z-20"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {dragDeltaDays > 0 ? `+${dragDeltaDays}d` : `${dragDeltaDays}d`}
          </div>
        )}

        {/* Right Resize Handle */}
        <div
          onPointerDown={(e) => onStartDrag(e, 'resize-end')}
          style={{ backgroundColor: project.color }}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:w-2 transition-all z-20"
          title="Drag right edge to change End Date"
        />
      </div>

      {/* Dedicated Clash Info Panel on Mouseover or Click of Clash Badge */}
      {isClashPanelOpen &&
        collidingPredecessors.length > 0 &&
        !dragMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={clashCardRef}
            onMouseEnter={openClashCard}
            onMouseLeave={scheduleCloseClashCard}
            onClick={(e) => e.stopPropagation()}
            style={{
              left: `${clashCardPos.left}px`,
              top: `${clashCardPos.top}px`,
              width: '380px',
              minWidth: '380px',
              maxWidth: '380px',
              zIndex: 10000,
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--status-overrun)',
              color: 'var(--text-primary)'
            }}
            className="fixed rounded border p-3.5 shadow-2xl space-y-2.5 text-xs"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between gap-2 pb-2 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="flex items-center gap-1.5 font-semibold text-sm"
                style={{ color: 'var(--status-overrun)' }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Dependency Schedule Clash</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tabular-nums"
                  style={{
                    backgroundColor: 'var(--status-overrun-bg)',
                    color: 'var(--status-overrun)'
                  }}
                >
                  {collidingPredecessors.length}{' '}
                  {collidingPredecessors.length === 1 ? 'Conflict' : 'Conflicts'}
                </span>
                <button
                  type="button"
                  onClick={closeClashPanelCompletely}
                  className="p-0.5 rounded hover:opacity-75"
                  style={{ color: 'var(--text-muted)' }}
                  title="Close clash panel"
                  aria-label="Close clash panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dependent Project Info */}
            <div
              className="p-2.5 rounded border space-y-1 tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <div
                className="text-[10px] uppercase font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Dependent Project (Starts Too Early)
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span>{project.name}</span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {project.startDate} → {project.endDate}
                </span>
              </div>
            </div>

            {/* Blocking Prerequisite Projects */}
            <div className="space-y-1.5">
              <div
                className="text-[10px] uppercase font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Prerequisite {collidingPredecessors.length === 1 ? 'Project' : 'Projects'} Not Yet
                Finished
              </div>
              {collidingPredecessors.map((pred) => {
                const overlapDays = Math.max(
                  1,
                  differenceInCalendarDays(
                    parseLocalDate(pred.endDate),
                    parseLocalDate(project.startDate)
                  ) + 1
                )
                const proposedShift = computeClashResolutionShift(
                  project.startDate,
                  project.endDate,
                  pred.endDate,
                  holidaySet
                )
                const isConfirmingThis = confirmingClashPredId === pred.id

                return (
                  <div
                    key={pred.id}
                    className="p-2.5 rounded border space-y-2 tabular-nums"
                    style={{
                      backgroundColor: 'var(--status-overrun-bg)',
                      borderColor: 'var(--status-overrun)'
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 shrink-0"
                          style={{ backgroundColor: pred.color }}
                        />
                        <span>{pred.name}</span>
                      </span>
                      <span
                        className="font-semibold whitespace-nowrap"
                        style={{ color: 'var(--status-overrun)' }}
                      >
                        Ends {pred.endDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Overlap:{' '}
                        <strong>
                          {overlapDays} calendar {overlapDays === 1 ? 'day' : 'days'}
                        </strong>{' '}
                        before prerequisite completes
                      </span>
                      {!isPresentationMode && !isConfirmingThis && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsClashPinned(true)
                            setConfirmingClashPredId(pred.id)
                          }}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold text-white whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
                          style={{ backgroundColor: 'var(--status-overrun)' }}
                        >
                          Resolve Clash
                        </button>
                      )}
                    </div>

                    {/* Two-Step User Confirmation Box before Taking Final Action */}
                    {!isPresentationMode && isConfirmingThis && (
                      <div
                        className="p-2.5 rounded border space-y-2 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-strong)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <div className="font-semibold leading-snug">
                          Confirm schedule shift for {project.name}?
                        </div>
                        <div
                          className="text-[11px] leading-snug"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Moves dates by{' '}
                          <strong>
                            +{proposedShift.deltaBusinessDays} working{' '}
                            {proposedShift.deltaBusinessDays === 1 ? 'day' : 'days'}
                          </strong>{' '}
                          to{' '}
                          <strong className="whitespace-nowrap">
                            {proposedShift.newStartDate} → {proposedShift.newEndDate}
                          </strong>{' '}
                          (after {pred.name} completes).
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmingClashPredId(null)
                            }}
                            className="px-2.5 py-1 rounded border text-[11px] font-medium hover:opacity-80 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              closeClashPanelCompletely()
                              onAutoResolveClash(pred)
                            }}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold text-white hover:opacity-90 cursor-pointer"
                            style={{ backgroundColor: 'var(--status-overrun)' }}
                          >
                            Confirm &amp; Shift
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>,
          document.body
        )}

      {/* Standardized, Fixed-Width (380px) Hover Disclosure Card — Identical size & layout for every project */}
      {isHovered &&
        !isClashPanelOpen &&
        !dragMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={hoverCardRef}
            onMouseEnter={openHoverCard}
            onMouseLeave={scheduleCloseHoverCard}
            onClick={(e) => e.stopPropagation()}
            style={{
              left: `${cardPos.left}px`,
              top: `${cardPos.top}px`,
              width: '380px',
              minWidth: '380px',
              maxWidth: '380px',
              zIndex: 9999,
              backgroundColor: 'var(--bg-surface)',
              borderColor:
                collidingPredecessors.length > 0
                  ? 'var(--status-overrun)'
                  : 'var(--accent-primary)',
              color: 'var(--text-primary)'
            }}
            className="fixed rounded border p-3.5 shadow-2xl space-y-2.5 text-xs"
          >
            {/* Row 1: Project Title & Quick Action Buttons */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span
                  className="w-3 h-3 mt-0.5 shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <div className="font-editorial font-semibold text-sm break-words leading-snug">
                  {project.name}
                </div>
              </div>

              {!isPresentationMode && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsHovered(false)
                      onTogglePopover()
                    }}
                    className="px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 hover:opacity-85 whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      borderColor: 'var(--accent-primary)',
                      color: '#ffffff'
                    }}
                    title="Open Project Details"
                  >
                    <Plus className="w-3 h-3" />
                    Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsHovered(false)
                      onSendBackToDeck()
                    }}
                    className="px-2 py-1 rounded border text-[11px] font-medium flex items-center gap-1 hover:opacity-85 whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--status-overrun)'
                    }}
                    title="Send back to Projects on Deck"
                  >
                    <X className="w-3 h-3" />
                    To Deck
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Dedicated Single-Line Start/End Dates & Certainty Status Bar */}
            <div
              className="flex items-center justify-between px-2.5 py-1.5 rounded border whitespace-nowrap tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <div
                className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                style={{ color: 'var(--text-primary)' }}
              >
                <Calendar
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: 'var(--accent-primary)' }}
                />
                <span className="whitespace-nowrap">
                  {project.startDate} → {project.endDate}
                </span>
              </div>
              <span
                className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)'
                }}
              >
                {project.certainty}
              </span>
            </div>

            {/* Optional Clash Alert Banner inside Project Hover Panel if Clashing */}
            {collidingPredecessors.length > 0 && (
              <div
                className="p-2.5 rounded border space-y-1.5 tabular-nums"
                style={{
                  backgroundColor: 'var(--status-overrun-bg)',
                  borderColor: 'var(--status-overrun)'
                }}
              >
                <div
                  className="flex items-center justify-between gap-2 font-semibold text-xs"
                  style={{ color: 'var(--status-overrun)' }}
                >
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Dependency Schedule Clash
                  </span>
                  {!isPresentationMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsHovered(false)
                        setIsClashPinned(true)
                        setConfirmingClashPredId(collidingPredecessors[0].id)
                        openClashCard()
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: 'var(--status-overrun)' }}
                    >
                      Resolve Clash…
                    </button>
                  )}
                </div>
                {collidingPredecessors.map((pred) => {
                  const overlapDays = Math.max(
                    1,
                    differenceInCalendarDays(
                      parseLocalDate(pred.endDate),
                      parseLocalDate(project.startDate)
                    ) + 1
                  )
                  return (
                    <div
                      key={pred.id}
                      className="text-[11px] leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Starts on <strong>{project.startDate}</strong> before prerequisite{' '}
                      <strong>{pred.name}</strong> finishes on <strong>{pred.endDate}</strong>{' '}
                      ({overlapDays}d overlap).
                    </div>
                  )
                })}
              </div>
            )}

            {/* Row 3: Standardized 2-Column Cost & Effort Grid */}
            <div className="grid grid-cols-2 gap-2 tabular-nums">
              <div
                className="p-2 rounded border"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Total Cost
                </div>
                <div className="font-semibold text-xs mt-0.5 whitespace-nowrap">
                  {formatDollarWhole(totalCost)}
                  {totalCost >= 1000000 ? ` (${formatDollarCompact(totalCost)})` : ''}
                </div>
              </div>
              <div
                className="p-2 rounded border"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Allocated Effort
                </div>
                <div className="font-semibold text-xs mt-0.5 whitespace-nowrap">
                  {Math.round(totalHours).toLocaleString()} hrs
                </div>
              </div>
            </div>

            {/* Row 4: Standardized Assigned Resources Section */}
            <div
              className="p-2 rounded border min-h-[52px]"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <Users className="w-3 h-3" />
                Assigned Resources ({assignedPeopleFullNames.length})
              </div>
              {assignedPeopleFullNames.length === 0 ? (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  No resources assigned — drag people onto this bar.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {assignedPeopleFullNames.map((name, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded border text-[11px] font-medium"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)'
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dependencies Summary (if linked) */}
            {(allPredecessors.length > 0 || allSuccessors.length > 0) && (
              <div
                className="pt-1.5 border-t space-y-1 text-[11px]"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {allPredecessors.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>Depends On:</span>
                    <span className="font-medium text-right">
                      {allPredecessors.map((p) => p.name).join(', ')}
                    </span>
                  </div>
                )}
                {allSuccessors.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>Required By:</span>
                    <span className="font-medium text-right">
                      {allSuccessors.map((p) => p.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Milestone Markers */}
      {milestones.map((ms) => {
        const msLeft = getDateOffsetPercent(ms.targetDate)
        return (
          <div
            key={ms.id}
            style={{ left: `${msLeft}%` }}
            className="absolute -top-1.5 z-20 -translate-x-1/2 pointer-events-auto"
            title={`Milestone: ${ms.name} (${ms.targetDate})`}
          >
            <div
              className="px-1 rounded-xs text-[9px] font-medium border shadow-2xs whitespace-nowrap flex items-center gap-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)'
              }}
            >
              <span
                className="w-2 h-2 shrink-0 inline-block"
                style={{ backgroundColor: ms.color || 'var(--accent-primary)' }}
                aria-hidden="true"
              />
              <span>{ms.name}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}


