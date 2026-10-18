import React, { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Trash2,
  ArrowRight,
  SlidersHorizontal,
  Search,
  X,
  Table2,
  CalendarOff
} from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import type { Person, Project } from '../../../shared/types'
import {
  buildHolidayWeekdaySet,
  calculateUtilizationHeatmap,
  computeProjectTotalFinancials,
  getHorizonMonths
} from '../../../shared/engine/calculator'
import {
  formatCommaInput,
  formatDollarCompact,
  formatDollarWhole,
  parseCommaInput
} from '../../../shared/engine/formatters'

interface DraggableDeckProjectItemProps {
  project: Project
  totalCost: number
  assignedCount: number
  onOpenDetails: () => void
  onSendToTimeline: () => void
  onDelete: () => void
}

const DraggableDeckProjectItem: React.FC<DraggableDeckProjectItemProps> = ({
  project,
  totalCost,
  assignedCount,
  onOpenDetails,
  onSendToTimeline,
  onDelete
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `deck-project::${project.id}`,
    data: {
      type: 'deck-project',
      project
    }
  })

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={onOpenDetails}
      style={{
        opacity: isDragging ? 0.35 : 1,
        backgroundColor: 'var(--bg-surface)',
        borderColor: confirmDelete ? 'var(--status-overrun)' : 'var(--border-subtle)'
      }}
      className="group relative rounded border p-2 transition-colors"
      title="Double-click to view or edit project details"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div
          {...listeners}
          {...attributes}
          className="flex items-start gap-1.5 cursor-grab active:cursor-grabbing flex-1 min-w-0"
        >
          <GripVertical
            className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-40 group-hover:opacity-90"
            style={{ color: 'var(--text-muted)' }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <span
                className="w-2.5 h-2.5 mt-1 shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-xs font-medium break-words leading-snug">
                {project.name}
              </span>
            </div>
            <div
              className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[11px] tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span title={formatDollarWhole(totalCost)}>
                {formatDollarWhole(totalCost)}
                {totalCost >= 1000000 ? ` (${formatDollarCompact(totalCost)})` : ''}
              </span>
              <span>·</span>
              <span>
                {project.startDate.slice(5)} → {project.endDate.slice(5)}
              </span>
              {assignedCount > 0 && (
                <>
                  <span>·</span>
                  <span>{assignedCount}p</span>
                </>
              )}
            </div>
          </div>
        </div>

        {!confirmDelete ? (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetails()
              }}
              title="Project Details (or double-click card)"
              aria-label={`Open project details for ${project.name}`}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: 'var(--accent-primary)' }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSendToTimeline()
              }}
              title="Schedule on Timeline"
              aria-label={`Schedule ${project.name} on timeline`}
              className="p-1 rounded hover:bg-black/5 opacity-70 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDelete(true)
              }}
              title="Delete Project"
              aria-label={`Delete project ${project.name}`}
              className="p-1 rounded hover:bg-black/5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
              style={{ color: 'var(--status-overrun)' }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDelete}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: 'var(--status-overrun)' }}
              title={
                assignedCount > 0
                  ? `Deletes project and ${assignedCount} resource assignments`
                  : 'Confirm delete project'
              }
            >
              {assignedCount > 0 ? `Delete (${assignedCount}p)` : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-1.5 py-0.5 rounded border text-[10px]"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface DraggablePersonItemProps {
  person: Person
  peakUtil: number
  avgUtil: number
  isSelected: boolean
  isExpanded: boolean
  defaultHorizonMonth: string
  onToggleSelect: () => void
  onToggleExpand: () => void
}

const DraggablePersonItem: React.FC<DraggablePersonItemProps> = ({
  person,
  peakUtil,
  avgUtil,
  isSelected,
  isExpanded,
  defaultHorizonMonth,
  onToggleSelect,
  onToggleExpand
}) => {
  const {
    dataset,
    updatePerson,
    deletePerson,
    upsertTimeOff,
    removeTimeOff,
    setFocusedProjectId,
    setViewMode
  } = useDeckStore()

  const [isEditing, setIsEditing] = useState(false)
  const [confirmRemovePerson, setConfirmRemovePerson] = useState(false)
  const [addingTimeOff, setAddingTimeOff] = useState(false)
  const [editName, setEditName] = useState(person.name)
  const [editRole, setEditRole] = useState(person.role)
  const [editHours, setEditHours] = useState(String(person.hoursPerDay))
  const [editRate, setEditRate] = useState(formatCommaInput(person.hourlyRate))
  const [editStart, setEditStart] = useState(person.startDate || '')

  const [timeOffReason, setTimeOffReason] = useState('Vacation')
  const [timeOffStart, setTimeOffStart] = useState(`${defaultHorizonMonth}-15`)
  const [timeOffEnd, setTimeOffEnd] = useState(`${defaultHorizonMonth}-19`)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-person::${person.id}`,
    data: {
      type: 'sidebar-person',
      person
    }
  })

  const personAssignments = dataset.assignments.filter((a) => a.personId === person.id)
  const personTimeOffList = dataset.timeOff.filter((t) => t.personId === person.id)

  const handleSaveEdit = (): void => {
    updatePerson(person.id, {
      name: editName.trim() || person.name,
      role: editRole.trim() || 'General',
      hoursPerDay: Math.max(1, Math.min(24, Number(editHours) || 8)),
      hourlyRate: parseCommaInput(editRate),
      startDate: editStart.trim() ? editStart.trim() : null
    })
    setIsEditing(false)
    setConfirmRemovePerson(false)
  }

  const handleAddTimeOff = (): void => {
    if (!timeOffStart || !timeOffEnd) return
    upsertTimeOff({
      personId: person.id,
      reason: timeOffReason.trim() || 'Time Off',
      startDate: timeOffStart,
      endDate: timeOffEnd >= timeOffStart ? timeOffEnd : timeOffStart,
      hoursPerDayOff: person.hoursPerDay
    })
    setAddingTimeOff(false)
  }

  const utilColor =
    peakUtil > 100
      ? 'var(--status-overrun)'
      : avgUtil >= 70
        ? 'var(--status-optimal)'
        : 'var(--text-secondary)'

  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.35 : 1,
        backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'
      }}
      className={`group rounded border p-2 transition-colors ${
        person.isPlaceholder ? 'border-dashed' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-start gap-1 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select ${person.name} for multi-person assignment`}
            title="Select multiple people to drag onto a project together"
            className="mt-1 rounded-none cursor-pointer shrink-0"
          />

          <button
            onClick={onToggleExpand}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${person.name}`}
            aria-expanded={isExpanded}
            className="p-0.5 mt-0.5 rounded hover:opacity-80 shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <div
            {...listeners}
            {...attributes}
            className="flex items-start gap-1.5 cursor-grab active:cursor-grabbing min-w-0 flex-1"
            title="Drag onto a timeline project bar"
          >
            <GripVertical
              className="w-3 h-3 mt-1 shrink-0 opacity-35 group-hover:opacity-90"
              style={{ color: 'var(--text-muted)' }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium break-words leading-snug">
                  {person.name}
                </span>
                {person.isPlaceholder && (
                  <span
                    className="text-[9px] uppercase px-1 rounded-xs border shrink-0"
                    style={{
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    TBD
                  </span>
                )}
              </div>
              <div
                className="text-[10px] break-words tabular-nums mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {person.role} · {person.hoursPerDay}h/d
                {person.hourlyRate > 0
                  ? ` · ${formatDollarWhole(person.hourlyRate)}/h`
                  : ''}
                {personTimeOffList.length > 0
                  ? ` · ${personTimeOffList.length} Time Off`
                  : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (!isExpanded) onToggleExpand()
              setAddingTimeOff(true)
            }}
            title="Add or manage Time Off"
            aria-label={`Time Off for ${person.name}`}
            className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus:opacity-100 text-[10px] underline transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
          >
            time off
          </button>
          <button
            onClick={() => {
              setIsEditing(!isEditing)
              setConfirmRemovePerson(false)
              if (!isExpanded) onToggleExpand()
            }}
            aria-label={`Edit ${person.name}`}
            className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus:opacity-100 text-[10px] underline transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            edit
          </button>
          <span
            className="text-[11px] font-medium tabular-nums"
            style={{ color: utilColor }}
            title={`Average utilization: ${avgUtil}% | Peak month: ${peakUtil}%`}
          >
            {peakUtil > 100 ? `${peakUtil}%` : `${avgUtil}%`}
          </span>
        </div>
      </div>

      {/* Inline Editor */}
      {isEditing && (
        <div
          className="mt-2 pt-2 border-t space-y-2 text-xs"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-1.5 py-1 rounded border text-xs bg-transparent"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </div>
            <div>
              <label className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                Role
              </label>
              <input
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-1.5 py-1 rounded border text-xs bg-transparent"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </div>
            <div>
              <label className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                Hours / Day
              </label>
              <input
                type="number"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                className="w-full px-1.5 py-1 rounded border text-xs bg-transparent tabular-nums"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </div>
            <div>
              <label className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                Rate ($/hr)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={editRate}
                onChange={(e) => setEditRate(formatCommaInput(e.target.value))}
                className="w-full px-1.5 py-1 rounded border text-xs bg-transparent tabular-nums"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </div>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex-1">
              <label className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                Start / Hire Date
              </label>
              <input
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="w-full px-1.5 py-1 rounded border text-[11px] bg-transparent tabular-nums"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </div>
            <button
              type="button"
              onClick={() => setAddingTimeOff(true)}
              className="px-2 py-1 rounded border text-[11px] font-medium flex items-center gap-1 shrink-0"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--accent-primary)'
              }}
            >
              <CalendarOff className="w-3 h-3" />
              + Time Off
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            {!confirmRemovePerson ? (
              <button
                onClick={() => setConfirmRemovePerson(true)}
                className="text-[11px] hover:underline"
                style={{ color: 'var(--status-overrun)' }}
              >
                Remove Person...
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => deletePerson(person.id)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: 'var(--status-overrun)' }}
                  title={
                    personAssignments.length > 0
                      ? `Removes resource and ${personAssignments.length} project assignments`
                      : 'Confirm remove resource'
                  }
                >
                  {personAssignments.length > 0
                    ? `Confirm Remove (${personAssignments.length}p)`
                    : 'Confirm Remove'}
                </button>
                <button
                  onClick={() => setConfirmRemovePerson(false)}
                  className="px-1.5 py-0.5 rounded border text-[10px]"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsEditing(false)
                  setConfirmRemovePerson(false)
                }}
                className="px-2 py-0.5 rounded text-[11px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-2.5 py-0.5 rounded text-[11px] font-medium text-white"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Assigned Projects & Time Off */}
      {isExpanded && (
        <div
          className="mt-2 pt-2 border-t space-y-1.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {personAssignments.length === 0 ? (
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              No assigned projects.
            </div>
          ) : (
            personAssignments.map((asn) => {
              const proj = dataset.projects.find((p) => p.id === asn.projectId)
              if (!proj) return null
              return (
                <button
                  key={asn.id}
                  onClick={() => {
                    setViewMode('split-timeline')
                    setFocusedProjectId(proj.id)
                  }}
                  className="w-full flex items-center justify-between px-1.5 py-1 rounded text-left text-[11px] hover:opacity-80 gap-2"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  <span className="flex items-start gap-1.5 min-w-0 flex-1">
                    <span
                      className="w-2 h-2 mt-1 shrink-0"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="break-words leading-snug">{proj.name}</span>
                  </span>
                  <span
                    className="tabular-nums text-[10px] shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {asn.allocationMode === 'total_hours'
                      ? `${asn.allocationValue}h`
                      : asn.allocationMode === 'hours_per_day'
                        ? `${asn.allocationValue}h/d`
                        : `${asn.allocationValue}%`}
                  </span>
                </button>
              )
            })
          )}

          {/* Time Off Section */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <CalendarOff className="w-3 h-3" />
                Time Off ({personTimeOffList.length})
              </span>
              <button
                onClick={() => setAddingTimeOff(!addingTimeOff)}
                className="px-1.5 py-0.5 rounded border text-[10px] font-medium hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--accent-primary)'
                }}
              >
                + Time Off
              </button>
            </div>

            {personTimeOffList.map((pto) => (
              <div
                key={pto.id}
                className="flex items-center justify-between text-[10px] px-1.5 py-1 mt-1 rounded tabular-nums"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <span className="break-words">
                  {pto.reason}: {pto.startDate.slice(5)} → {pto.endDate.slice(5)}
                </span>
                <button
                  onClick={() => removeTimeOff(pto.id)}
                  aria-label={`Remove ${pto.reason} time off`}
                  className="hover:underline ml-1 px-1"
                  style={{ color: 'var(--status-overrun)' }}
                >
                  ×
                </button>
              </div>
            ))}

            {addingTimeOff && (
              <div
                className="mt-1.5 p-2 rounded border space-y-1.5"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <div>
                  <label
                    className="text-[10px] block mb-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Reason
                  </label>
                  <input
                    value={timeOffReason}
                    onChange={(e) => setTimeOffReason(e.target.value)}
                    placeholder="Vacation, Leave, Conference..."
                    className="w-full px-1.5 py-1 rounded border text-[11px] bg-transparent"
                    style={{ borderColor: 'var(--border-strong)' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label
                      className="text-[10px] block mb-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Start
                    </label>
                    <input
                      type="date"
                      aria-label="Time off start date"
                      value={timeOffStart}
                      onChange={(e) => setTimeOffStart(e.target.value)}
                      className="w-full px-1 py-0.5 rounded border text-[10px] bg-transparent tabular-nums"
                      style={{ borderColor: 'var(--border-strong)' }}
                    />
                  </div>
                  <div>
                    <label
                      className="text-[10px] block mb-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      End
                    </label>
                    <input
                      type="date"
                      aria-label="Time off end date"
                      value={timeOffEnd}
                      onChange={(e) => setTimeOffEnd(e.target.value)}
                      className="w-full px-1 py-0.5 rounded border text-[10px] bg-transparent tabular-nums"
                      style={{ borderColor: 'var(--border-strong)' }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1 pt-0.5">
                  <button
                    onClick={() => setAddingTimeOff(false)}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTimeOff}
                    className="text-[10px] px-2.5 py-0.5 rounded font-medium text-white"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    Save Time Off
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface LeftSidebarProps {
  width: number
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ width }) => {
  const {
    dataset,
    isPresentationMode,
    selectedPersonIds,
    setActiveModal,
    setSelectedProjectForPopover,
    moveProjectStatus,
    deleteProject,
    setViewMode,
    toggleSelectPerson,
    clearSelectedPeople
  } = useDeckStore()

  // Start people cards cleanly collapsed for progressive disclosure
  const [expandedPersonIds, setExpandedPersonIds] = useState<Record<string, boolean>>({})
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [projectSearch, setProjectSearch] = useState<string>('')
  const [personSearch, setPersonSearch] = useState<string>('')

  const horizonMonths = useMemo(() => getHorizonMonths(dataset), [dataset])
  const defaultHorizonMonth = horizonMonths[0]?.yearMonth || '2026-06'
  const holidaySet = useMemo(() => buildHolidayWeekdaySet(dataset.holidays), [dataset.holidays])
  const peopleMap = useMemo(
    () => new Map(dataset.people.map((p) => [p.id, p])),
    [dataset.people]
  )
  const allOnDeckProjects = useMemo(
    () => dataset.projects.filter((p) => p.status === 'on_deck'),
    [dataset.projects]
  )
  const filteredOnDeckProjects = useMemo(
    () =>
      allOnDeckProjects.filter((p) =>
        projectSearch.trim()
          ? p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
          : true
      ),
    [allOnDeckProjects, projectSearch]
  )

  const heatmapByPerson = useMemo(() => {
    const heatmap = calculateUtilizationHeatmap(dataset)
    return new Map(heatmap.map((h) => [h.person.id, h]))
  }, [dataset])

  const uniqueRoles = useMemo(
    () => Array.from(new Set(dataset.people.map((p) => p.role))),
    [dataset.people]
  )
  const visiblePeople = useMemo(
    () =>
      dataset.people.filter((p) => {
        if (roleFilter !== 'ALL' && p.role !== roleFilter) return false
        if (personSearch.trim()) {
          const q = personSearch.trim().toLowerCase()
          return (
            p.name.toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q) ||
            p.department.toLowerCase().includes(q)
          )
        }
        return true
      }),
    [dataset.people, roleFilter, personSearch]
  )

  if (isPresentationMode) {
    return null
  }

  return (
    <aside
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--bg-canvas)',
        borderColor: 'var(--border-subtle)'
      }}
      className="border-r flex flex-col shrink-0 h-full select-none overflow-hidden"
    >
      {/* Top Action Buttons: Set Budgets & Holidays */}
      <div
        className="p-2.5 border-b grid grid-cols-2 gap-1.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <button
          onClick={() => setActiveModal('budgets')}
          className="py-1.5 px-2.5 rounded border text-xs font-semibold transition-colors hover:opacity-85"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)'
          }}
        >
          Set Budgets
        </button>

        <button
          onClick={() => setActiveModal('holidays')}
          className="py-1.5 px-2.5 rounded border text-xs font-medium transition-colors hover:opacity-85 tabular-nums"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        >
          Holidays ({dataset.holidays.length})
        </button>
      </div>

      {/* Section 1: PROJECTS ON DECK */}
      <div
        className="flex-1 min-h-0 flex flex-col border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="px-2.5 py-2 border-b flex items-center justify-between gap-1"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            On Deck ({allOnDeckProjects.length})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveModal('manage-projects')}
              title="Open editable table view for all projects"
              className="px-1.5 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)'
              }}
            >
              <Table2 className="w-3 h-3" />
              All ({dataset.projects.length})
            </button>
            <button
              onClick={() => setActiveModal('add-projects')}
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Quick Search Projects on Deck */}
        <div
          className="px-2.5 py-1.5 border-b flex items-center gap-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <Search
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            aria-label="Filter projects on deck"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Filter on-deck projects..."
            className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {projectSearch && (
            <button
              onClick={() => setProjectSearch('')}
              aria-label="Clear project search"
              className="p-0.5 hover:opacity-75"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredOnDeckProjects.length === 0 ? (
            <div
              className="rounded border border-dashed p-3 text-center text-xs"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-muted)'
              }}
            >
              {allOnDeckProjects.length === 0 ? (
                <>
                  No staged projects on deck. Click <strong>+ Add</strong> above or send
                  a scheduled project back from the timeline.
                </>
              ) : (
                <>No on-deck projects match &ldquo;{projectSearch}&rdquo;.</>
              )}
            </div>
          ) : (
            filteredOnDeckProjects.map((project) => {
              const fin = computeProjectTotalFinancials(
                project,
                dataset.assignments,
                peopleMap,
                holidaySet
              )
              const assignedCount = dataset.assignments.filter(
                (a) => a.projectId === project.id
              ).length
              return (
                <DraggableDeckProjectItem
                  key={project.id}
                  project={project}
                  totalCost={fin.totalCost}
                  assignedCount={assignedCount}
                  onOpenDetails={() => setSelectedProjectForPopover(project.id)}
                  onSendToTimeline={() => {
                    moveProjectStatus(project.id, 'timeline')
                    setViewMode('split-timeline')
                  }}
                  onDelete={() => deleteProject(project.id)}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Section 2: PEOPLE */}
      <div className="flex-[1.35] min-h-0 flex flex-col">
        <div
          className="px-2.5 py-2 border-b flex items-center justify-between gap-1"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            People ({dataset.people.length})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveModal('manage-people')}
              title="Open editable table view for all resources"
              className="px-1.5 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)'
              }}
            >
              <Table2 className="w-3 h-3" />
              Edit All
            </button>
            <button
              onClick={() => setActiveModal('add-people')}
              className="text-xs font-semibold hover:underline shrink-0"
              style={{ color: 'var(--accent-primary)' }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Search & Role Filter Bar */}
        <div
          className="px-2.5 py-1.5 border-b space-y-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-1.5">
            <Search
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              aria-label="Filter people by name, role, or department"
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              placeholder="Search people or roles..."
              className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {personSearch && (
              <button
                onClick={() => setPersonSearch('')}
                aria-label="Clear people search"
                className="p-0.5 hover:opacity-75"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {uniqueRoles.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sidebar-role-filter"
                className="text-[10px] uppercase tracking-wider font-semibold shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                Role
              </label>
              <select
                id="sidebar-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex-1 px-2 py-0.5 rounded border text-xs font-medium min-w-0"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="ALL">All Roles ({dataset.people.length})</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>
                    {r} ({dataset.people.filter((p) => p.role === r).length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Multi-Select Action Banner */}
        {selectedPersonIds.length > 0 && (
          <div
            className="px-2.5 py-1.5 border-b flex items-center justify-between text-[11px]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
              {selectedPersonIds.length} selected — drag any to assign
            </span>
            <button
              onClick={clearSelectedPeople}
              className="text-[10px] underline hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {visiblePeople.length === 0 ? (
            <div
              className="rounded border border-dashed p-3 text-center text-xs"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-muted)'
              }}
            >
              No people match your filter.
            </div>
          ) : (
            visiblePeople.map((person) => {
              const hm = heatmapByPerson.get(person.id)
              return (
                <DraggablePersonItem
                  key={person.id}
                  person={person}
                  peakUtil={hm?.peakUtilization ?? 0}
                  avgUtil={hm?.averageUtilization ?? 0}
                  isSelected={selectedPersonIds.includes(person.id)}
                  isExpanded={Boolean(expandedPersonIds[person.id])}
                  defaultHorizonMonth={defaultHorizonMonth}
                  onToggleSelect={() => toggleSelectPerson(person.id)}
                  onToggleExpand={() =>
                    setExpandedPersonIds((prev) => ({
                      ...prev,
                      [person.id]: !prev[person.id]
                    }))
                  }
                />
              )
            })
          )}
        </div>
      </div>
    </aside>
  )
}
