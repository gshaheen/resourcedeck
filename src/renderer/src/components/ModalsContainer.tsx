import React, { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  X,
  Plus,
  Trash2,
  ClipboardPaste,
  Database,
  Copy,
  Check,
  Download,
  CalendarOff,
  GitBranch,
  DollarSign,
  FolderPlus,
  UserPlus,
  Users,
  Search,
  Table2,
  SlidersHorizontal
} from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import type {
  AllocationMode,
  MonthlyBudget,
  Person,
  Project
} from '../../../shared/types'
import {
  buildHolidayWeekdaySet,
  computeAssignmentTotalHours,
  computeProjectTotalFinancials,
  getHorizonMonths,
  getWorkingWeekdaysInRange
} from '../../../shared/engine/calculator'
import {
  formatCommaInput,
  formatDollarCompact,
  formatDollarWhole,
  parseCommaInput
} from '../../../shared/engine/formatters'
import { rankSmartStaffSuggestions } from '../../../shared/engine/smartStaff'
import { generateAiContextPack } from '../../../main/db/aiViews'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const PROJECT_COLORS = [
  '#4f46e5',
  '#0d9488',
  '#d97706',
  '#7c3aed',
  '#2563eb',
  '#db2777',
  '#059669',
  '#e11d48'
]

export const ModalsContainer: React.FC = () => {
  const {
    activeModal,
    selectedProjectForPopover,
    setActiveModal,
    setSelectedProjectForPopover
  } = useDeckStore()

  useEffect(() => {
    if (!activeModal && !selectedProjectForPopover) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (selectedProjectForPopover) {
          setSelectedProjectForPopover(null)
        } else if (activeModal) {
          setActiveModal(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeModal, selectedProjectForPopover, setActiveModal, setSelectedProjectForPopover])

  if (!activeModal && !selectedProjectForPopover) return null

  return (
    <>
      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        >
          {activeModal === 'budgets' && (
            <SetBudgetsModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'add-projects' && (
            <AddProjectsModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'add-people' && (
            <AddPeopleModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'manage-projects' && (
            <ManageAllProjectsModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'manage-people' && (
            <ManageAllPeopleModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'holidays' && (
            <HolidaysModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'ai-bridge' && (
            <AiBridgeModal onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'new-scenario' && (
            <NewScenarioModal onClose={() => setActiveModal(null)} />
          )}
        </div>
      )}

      {/* Global Project Details Modal — Works for BOTH On Deck and Timeline Projects */}
      {selectedProjectForPopover && (
        <div
          onClick={() => setSelectedProjectForPopover(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        >
          <ProjectDetailsModal
            projectId={selectedProjectForPopover}
            onClose={() => setSelectedProjectForPopover(null)}
          />
        </div>
      )}
    </>
  )
}

/**
 * 0. Spacious Project Details Modal (Works for On Deck and Scheduled Timeline Projects)
 */
const ProjectDetailsModal: React.FC<{
  projectId: string
  onClose: () => void
}> = ({ projectId, onClose }) => {
  const {
    dataset,
    updateProject,
    moveProjectStatus,
    upsertAssignment,
    removeAssignment,
    addMilestone,
    removeMilestone,
    addDependency,
    removeDependency
  } = useDeckStore()

  const project = dataset.projects.find((p) => p.id === projectId)
  const [showSmartStaffTab, setShowSmartStaffTab] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDate, setNewMilestoneDate] = useState('')
  const [newDepTargetId, setNewDepTargetId] = useState('')

  const holidaySet = useMemo(
    () => buildHolidayWeekdaySet(dataset.holidays),
    [dataset.holidays]
  )
  const peopleMap = useMemo(
    () => new Map(dataset.people.map((p) => [p.id, p])),
    [dataset.people]
  )

  if (!project) return null

  const fin = computeProjectTotalFinancials(
    project,
    dataset.assignments,
    peopleMap,
    holidaySet
  )
  const projWorkingDays = getWorkingWeekdaysInRange(
    project.startDate,
    project.endDate,
    holidaySet
  ).length
  const projAsns = dataset.assignments.filter((a) => a.projectId === project.id)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Project details for ${project.name}`}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-md border p-6 md:p-7 shadow-2xl space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <input
            type="color"
            aria-label="Project color"
            value={project.color}
            onChange={(e) => updateProject(project.id, { color: e.target.value })}
            className="w-6 h-6 rounded-none cursor-pointer border-0 bg-transparent shrink-0"
          />
          <input
            aria-label="Project name"
            value={project.name}
            onChange={(e) => updateProject(project.id, { name: e.target.value })}
            className="font-editorial text-lg md:text-xl font-semibold bg-transparent border-b border-transparent focus:border-blue-600 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() =>
              moveProjectStatus(
                project.id,
                project.status === 'timeline' ? 'on_deck' : 'timeline'
              )
            }
            className="px-3 py-1.5 rounded border text-sm font-medium transition-colors hover:opacity-85"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            {project.status === 'timeline'
              ? 'Move to On Deck'
              : 'Schedule on Timeline'}
          </button>

          <button
            onClick={() => setShowSmartStaffTab(!showSmartStaffTab)}
            className="px-3 py-1.5 rounded text-sm font-medium border transition-colors"
            style={{
              backgroundColor: showSmartStaffTab
                ? 'var(--text-primary)'
                : 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: showSmartStaffTab ? 'var(--bg-surface)' : 'var(--text-primary)'
            }}
          >
            Suggest Available Staff
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div
        className="grid grid-cols-3 gap-4 p-3.5 rounded border text-sm tabular-nums"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total Project Cost
          </div>
          <div className="font-editorial font-bold text-base mt-0.5">
            {formatDollarWhole(fin.totalCost)}{' '}
            {fin.totalCost >= 10000 && (
              <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
                ({formatDollarCompact(fin.totalCost)})
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total Allocated Effort
          </div>
          <div className="font-editorial font-bold text-base mt-0.5">
            {Math.round(fin.totalHours).toLocaleString()} hrs{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
              ({projWorkingDays} working days)
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Placement Status
          </div>
          <div className="font-semibold text-sm mt-1">
            {project.status === 'timeline' ? 'Scheduled on Timeline' : 'Staged on Deck'} ·{' '}
            <span className="capitalize">{project.certainty}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: PEOPLE ASSIGNED */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <h4
            className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Users className="w-4 h-4" /> People Assigned ({projAsns.length})
          </h4>

          <div className="space-y-2">
            {projAsns.length === 0 ? (
              <div
                className="p-4 rounded border border-dashed text-sm text-center"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-muted)'
                }}
              >
                No people assigned yet. Select a person below to assign them.
              </div>
            ) : (
              projAsns.map((asn) => {
                const person = peopleMap.get(asn.personId)
                const computedTotalHrs = computeAssignmentTotalHours(
                  asn,
                  projWorkingDays,
                  person?.hoursPerDay ?? 8
                )
                return (
                  <div
                    key={asn.id}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 p-2.5 rounded border"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold break-words leading-snug">
                        {person?.name || 'Resource'}
                      </div>
                      <div
                        className="text-xs tabular-nums mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {person?.role} · {Math.round(computedTotalHrs).toLocaleString()}h total
                      </div>
                    </div>

                    <select
                      aria-label={`Allocation mode for ${person?.name || 'Resource'}`}
                      value={asn.allocationMode}
                      onChange={(e) =>
                        upsertAssignment(
                          project.id,
                          asn.personId,
                          asn.allocationValue,
                          e.target.value as AllocationMode
                        )
                      }
                      className="px-2.5 py-1.5 rounded border text-sm shrink-0"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-strong)'
                      }}
                    >
                      <option value="total_hours">Total Hours</option>
                      <option value="hours_per_day">Hours / Day</option>
                      <option value="percent">% Capacity</option>
                    </select>

                    <input
                      type="number"
                      aria-label={`Allocation value for ${person?.name || 'Resource'}`}
                      value={asn.allocationValue}
                      onChange={(e) =>
                        upsertAssignment(
                          project.id,
                          asn.personId,
                          Math.max(0, Number(e.target.value) || 0),
                          asn.allocationMode
                        )
                      }
                      className="w-24 px-2.5 py-1.5 rounded border text-sm font-semibold tabular-nums text-right shrink-0"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-strong)'
                      }}
                    />

                    <button
                      onClick={() => removeAssignment(asn.id)}
                      className="p-1.5 rounded hover:opacity-75 shrink-0"
                      style={{ color: 'var(--status-overrun)' }}
                      title="Unassign person"
                      aria-label={`Unassign ${person?.name || 'Resource'}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
            )}

            <div className="pt-1">
              <select
                aria-label="Assign a person or TBD role to this project"
                defaultValue=""
                onChange={(e) => {
                  const pid = e.target.value
                  if (!pid) return
                  upsertAssignment(project.id, pid, 80, 'total_hours')
                  e.target.value = ''
                }}
                className="w-full px-3 py-2 rounded border text-sm font-medium"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">+ Assign person or TBD role...</option>
                {dataset.people.map((pe) => (
                  <option key={pe.id} value={pe.id}>
                    {pe.name} ({pe.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showSmartStaffTab && (
            <div
              className="p-3.5 rounded border space-y-2"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="text-xs font-semibold">
                Available Bandwidth ({project.startDate} → {project.endDate})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {rankSmartStaffSuggestions(dataset, project, 80).map((sug) => (
                  <div
                    key={sug.person.id}
                    className="flex items-center justify-between p-2 rounded border text-sm gap-2"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium break-words">{sug.person.name}</span>
                      <span
                        className="ml-2 text-xs tabular-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {sug.availableHoursInWindow}h open ({sug.currentUtilizationInWindow}% load)
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        upsertAssignment(
                          project.id,
                          sug.person.id,
                          Math.min(
                            120,
                            Math.max(40, Math.round(sug.availableHoursInWindow * 0.5))
                          ),
                          'total_hours'
                        )
                      }
                      className="px-3 py-1 rounded text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: PROJECT INFO, MILESTONES & DEPENDENCIES */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <h4
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            Project Info
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="text-xs font-medium block mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={project.startDate}
                onChange={(e) =>
                  updateProject(project.id, { startDate: e.target.value })
                }
                className="w-full px-2.5 py-2 rounded border text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              />
            </div>
            <div>
              <label
                className="text-xs font-medium block mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                End Date
              </label>
              <input
                type="date"
                value={project.endDate}
                onChange={(e) =>
                  updateProject(project.id, { endDate: e.target.value })
                }
                className="w-full px-2.5 py-2 rounded border text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="text-xs font-medium block mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cost Mode
              </label>
              <select
                value={project.costMode}
                onChange={(e) =>
                  updateProject(project.id, {
                    costMode: e.target.value as Project['costMode']
                  })
                }
                className="w-full px-2.5 py-2 rounded border text-sm"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <option value="fixed">Fixed Lump Sum ($)</option>
                <option value="calculated">Rates + Non-Labor</option>
              </select>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {project.costMode === 'fixed' ? 'Cost ($)' : 'Non-Labor ($)'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCommaInput(project.fixedCost)}
                onChange={(e) =>
                  updateProject(project.id, {
                    fixedCost: parseCommaInput(e.target.value)
                  })
                }
                className="w-full px-3 py-2 rounded border text-sm font-semibold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              />
            </div>
          </div>

          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Pipeline Certainty
            </label>
            <select
              value={project.certainty}
              onChange={(e) =>
                updateProject(project.id, {
                  certainty: e.target.value as Project['certainty']
                })
              }
              className="w-full px-3 py-2 rounded border text-sm"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
            </select>
          </div>

          {/* Milestones */}
          <div
            className="pt-3 border-t space-y-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Milestones
            </div>
            {dataset.milestones
              .filter((m) => m.projectId === project.id)
              .map((ms) => (
                <div
                  key={ms.id}
                  className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded gap-2"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  <span className="break-words">
                    ■ {ms.name} ({ms.targetDate})
                  </span>
                  <button
                    onClick={() => removeMilestone(ms.id)}
                    className="hover:underline shrink-0 px-1"
                    style={{ color: 'var(--status-overrun)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            <div className="flex items-center gap-1.5">
              <input
                placeholder="Milestone name"
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded border text-sm bg-transparent"
                style={{ borderColor: 'var(--border-strong)' }}
              />
              <input
                type="date"
                value={newMilestoneDate || project.endDate}
                onChange={(e) => setNewMilestoneDate(e.target.value)}
                className="px-2 py-1.5 rounded border text-xs bg-transparent tabular-nums shrink-0"
                style={{ borderColor: 'var(--border-strong)' }}
              />
              <button
                onClick={() => {
                  if (!newMilestoneName.trim()) return
                  addMilestone({
                    projectId: project.id,
                    name: newMilestoneName.trim(),
                    targetDate: newMilestoneDate || project.endDate,
                    color: '#0f766e'
                  })
                  setNewMilestoneName('')
                }}
                className="px-3 py-1.5 rounded text-sm font-semibold text-white shrink-0"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Dependencies */}
          <div
            className="pt-3 border-t space-y-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Predecessor Dependency
            </div>
            {dataset.dependencies
              .filter((d) => d.toProjectId === project.id)
              .map((dep) => {
                const fromProj = dataset.projects.find(
                  (p) => p.id === dep.fromProjectId
                )
                return (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded gap-2"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <span className="break-words">
                      After: {fromProj?.name || dep.fromProjectId}
                    </span>
                    <button
                      onClick={() => removeDependency(dep.id)}
                      className="hover:underline shrink-0 px-1"
                      style={{ color: 'var(--status-overrun)' }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            <div className="flex items-center gap-1.5">
              <select
                value={newDepTargetId}
                onChange={(e) => setNewDepTargetId(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded border text-sm"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <option value="">Select predecessor...</option>
                {dataset.projects
                  .filter((p) => p.id !== project.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  if (!newDepTargetId) return
                  addDependency(newDepTargetId, project.id)
                  setNewDepTargetId('')
                }}
                className="px-3 py-1.5 rounded text-sm font-medium border shrink-0"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 1. Set Budgets Modal (Expanded inputs for long numbers with live comma formatting)
 */
const SetBudgetsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dataset, upsertBudgets } = useDeckStore()

  const existingYears = Array.from(new Set(dataset.budgets.map((b) => b.year))).sort()
  const initialYears =
    existingYears.length > 0 ? existingYears : [new Date().getFullYear()]

  const [years, setYears] = useState<number[]>(initialYears)
  const [grid, setGrid] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const b of dataset.budgets) {
      map[`${b.year}-${b.month}`] = Math.round(b.budgetAmount)
    }
    return map
  })
  const [quickFillAmount, setQuickFillAmount] = useState<string>('100,000')

  const existingBudgetMap = new Map(
    dataset.budgets.map((b) => [`${b.year}-${b.month}`, b])
  )

  const handleCellChange = (year: number, month: number, value: string): void => {
    const num = parseCommaInput(value)
    setGrid((prev) => ({ ...prev, [`${year}-${month}`]: num }))
  }

  const handleAddYear = (): void => {
    const nextYear = (years[years.length - 1] || new Date().getFullYear()) + 1
    setYears([...years, nextYear])
  }

  const handleYearNumberChange = (idx: number, newYearVal: number): void => {
    if (newYearVal < 2000 || newYearVal > 2100) return
    const oldYear = years[idx]
    const updatedYears = [...years]
    updatedYears[idx] = newYearVal
    setYears(updatedYears)

    setGrid((prev) => {
      const next = { ...prev }
      for (let m = 1; m <= 12; m++) {
        if (next[`${oldYear}-${m}`] !== undefined) {
          next[`${newYearVal}-${m}`] = next[`${oldYear}-${m}`]
        }
      }
      return next
    })
  }

  const applyQuickFillToYear = (year: number): void => {
    const amt = parseCommaInput(quickFillAmount)
    setGrid((prev) => {
      const next = { ...prev }
      for (let m = 1; m <= 12; m++) {
        next[`${year}-${m}`] = amt
      }
      return next
    })
  }

  const handleSave = (): void => {
    const out: MonthlyBudget[] = []
    for (const y of years) {
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${m}`
        const amt = Math.round(grid[key] ?? 0)
        const existing = existingBudgetMap.get(key)
        const capexRatio =
          existing && existing.budgetAmount > 0
            ? existing.capexBudget / existing.budgetAmount
            : 0.7
        const capexBudget = Math.round(amt * capexRatio)
        const opexBudget = Math.max(0, amt - capexBudget)

        out.push({
          scenarioId: dataset.scenario.id,
          year: y,
          month: m,
          budgetAmount: amt,
          capexBudget,
          opexBudget,
          meta: existing?.meta ?? {}
        })
      }
    }
    upsertBudgets(out)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set Monthly Budgets"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-6xl rounded-md border p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <DollarSign className="w-5 h-5" style={{ color: 'var(--status-optimal)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">Set Monthly Budgets</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Feeds the monthly target step line on the Budgets vs. Costs chart.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close monthly budgets dialog"
          className="p-1.5 rounded hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Multi-year rows — 6 months per row so larger numbers with commas fit comfortably */}
      <div className="space-y-4">
        {years.map((year, yIdx) => (
          <div
            key={yIdx}
            className="p-4 rounded border space-y-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider">Year</label>
                <input
                  type="number"
                  aria-label="Budget year"
                  value={year}
                  onChange={(e) => handleYearNumberChange(yIdx, Number(e.target.value))}
                  className="w-28 px-3 py-1.5 rounded border text-sm font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)'
                  }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Quick Fill ($):</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Quick fill monthly amount"
                  value={quickFillAmount}
                  onChange={(e) => setQuickFillAmount(formatCommaInput(e.target.value))}
                  className="w-40 px-3 py-1.5 rounded border text-sm font-semibold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)'
                  }}
                />
                <button
                  onClick={() => applyQuickFillToYear(year)}
                  className="px-3 py-1.5 rounded border text-xs font-semibold hover:opacity-85"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)'
                  }}
                >
                  Fill All 12 Months
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {MONTHS.map((mName, mIdx) => {
                const monthNum = mIdx + 1
                const val = grid[`${year}-${monthNum}`] ?? 0
                return (
                  <div key={monthNum} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label
                        className="font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {mName.slice(0, 3)}
                      </label>
                      <span
                        className="text-[10px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatDollarCompact(val)}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span
                        className="absolute left-2.5 text-xs font-semibold pointer-events-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${mName} ${year} budget`}
                        value={formatCommaInput(val)}
                        onChange={(e) => handleCellChange(year, monthNum, e.target.value)}
                        className="w-full pl-6 pr-2.5 py-2 rounded border text-sm font-semibold tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-strong)'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleAddYear}
          className="text-xs font-semibold hover:underline flex items-center gap-1"
          style={{ color: 'var(--accent-primary)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Year
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border text-xs font-medium"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Save Budgets
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 2. Dedicated All Projects Editable Table Screen ('manage-projects')
 */
const ManageAllProjectsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    dataset,
    updateProject,
    deleteProject,
    addProjects,
    setSelectedProjectForPopover
  } = useDeckStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'on_deck' | 'timeline'>('ALL')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const horizonMonths = getHorizonMonths(dataset)
  const firstMonth = horizonMonths[0]?.yearMonth || '2026-06'
  const thirdMonth = horizonMonths[2]?.yearMonth || '2026-08'
  const holidaySet = useMemo(
    () => buildHolidayWeekdaySet(dataset.holidays),
    [dataset.holidays]
  )
  const peopleMap = useMemo(
    () => new Map(dataset.people.map((p) => [p.id, p])),
    [dataset.people]
  )

  const filteredProjects = dataset.projects.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (search.trim()) {
      return p.name.toLowerCase().includes(search.trim().toLowerCase())
    }
    return true
  })

  const handleAddNewRow = (): void => {
    const idx = dataset.projects.length
    addProjects([
      {
        name: `New Project ${idx + 1}`,
        startDate: `${firstMonth}-01`,
        endDate: `${thirdMonth}-28`,
        status: 'on_deck',
        certainty: 'confirmed',
        priorityRank: idx + 1,
        valueScore: 75,
        costMode: 'fixed',
        fixedCost: 50000,
        capexPercent: 70,
        blendedHourlyRate: 115,
        color: PROJECT_COLORS[idx % PROJECT_COLORS.length],
        meta: {}
      }
    ])
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="View and Edit All Projects"
      onClick={(e) => e.stopPropagation()}
      className="w-[95vw] max-w-6xl h-[86vh] rounded-md border p-6 shadow-2xl flex flex-col gap-4 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <Table2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              View &amp; Edit All Projects ({dataset.projects.length})
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              All edits save automatically to your <code>.rdeck</code> file and support Undo (Cmd+Z).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="bg-transparent focus:outline-none w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter projects by status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'on_deck' | 'timeline')
            }
            className="px-2.5 py-1.5 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <option value="ALL">All Statuses ({dataset.projects.length})</option>
            <option value="timeline">
              Scheduled on Timeline (
              {dataset.projects.filter((p) => p.status === 'timeline').length})
            </option>
            <option value="on_deck">
              Staged on Deck (
              {dataset.projects.filter((p) => p.status === 'on_deck').length})
            </option>
          </select>

          <button
            onClick={handleAddNewRow}
            className="px-3 py-1.5 rounded text-xs font-semibold text-white flex items-center gap-1"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Project
          </button>

          <button
            onClick={onClose}
            aria-label="Close all projects table"
            className="p-1.5 rounded hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editable Table */}
      <div className="flex-1 overflow-auto rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr
              className="border-b text-left sticky top-0 z-10"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <th className="py-2.5 px-2.5 font-semibold w-10">Color</th>
              <th className="py-2.5 px-2.5 font-semibold min-w-[220px]">Project Name</th>
              <th className="py-2.5 px-2.5 font-semibold w-32">Placement</th>
              <th className="py-2.5 px-2.5 font-semibold w-28">Pipeline</th>
              <th className="py-2.5 px-2.5 font-semibold w-34">Start Date</th>
              <th className="py-2.5 px-2.5 font-semibold w-34">End Date</th>
              <th className="py-2.5 px-2.5 font-semibold w-36">Cost Mode</th>
              <th className="py-2.5 px-2.5 font-semibold w-36">Cost / Non-Labor ($)</th>
              <th className="py-2.5 px-2.5 font-semibold w-32 text-right">Total Cost</th>
              <th className="py-2.5 px-2.5 font-semibold w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => {
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
                <tr
                  key={project.id}
                  className="border-b"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="p-2 text-center">
                    <input
                      type="color"
                      aria-label={`Color for ${project.name}`}
                      value={project.color}
                      onChange={(e) =>
                        updateProject(project.id, { color: e.target.value })
                      }
                      className="w-5 h-5 rounded-none cursor-pointer border-0 bg-transparent"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="Project name"
                      value={project.name}
                      onChange={(e) =>
                        updateProject(project.id, { name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs font-semibold"
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      aria-label="Project placement status"
                      value={project.status}
                      onChange={(e) =>
                        updateProject(project.id, {
                          status: e.target.value as Project['status']
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs cursor-pointer"
                    >
                      <option value="timeline">Timeline</option>
                      <option value="on_deck">On Deck</option>
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select
                      aria-label="Project certainty"
                      value={project.certainty}
                      onChange={(e) =>
                        updateProject(project.id, {
                          certainty: e.target.value as Project['certainty']
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs cursor-pointer"
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="tentative">Tentative</option>
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      type="date"
                      aria-label="Start date"
                      value={project.startDate}
                      onChange={(e) =>
                        updateProject(project.id, { startDate: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs tabular-nums"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="date"
                      aria-label="End date"
                      value={project.endDate}
                      onChange={(e) =>
                        updateProject(project.id, { endDate: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs tabular-nums"
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      aria-label="Cost mode"
                      value={project.costMode}
                      onChange={(e) =>
                        updateProject(project.id, {
                          costMode: e.target.value as Project['costMode']
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs cursor-pointer"
                    >
                      <option value="fixed">Fixed Lump Sum</option>
                      <option value="calculated">Rates + Non-Labor</option>
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Fixed or non-labor cost"
                      value={formatCommaInput(project.fixedCost)}
                      onChange={(e) =>
                        updateProject(project.id, {
                          fixedCost: parseCommaInput(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs font-semibold tabular-nums text-right"
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums font-semibold">
                    <div>{formatDollarWhole(fin.totalCost)}</div>
                    <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      {assignedCount}p · {Math.round(fin.totalHours)}h
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    {confirmDeleteId === project.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            deleteProject(project.id)
                            setConfirmDeleteId(null)
                          }}
                          className="px-2 py-1 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                          style={{ backgroundColor: 'var(--status-overrun)' }}
                          title={
                            assignedCount > 0
                              ? `Deletes project and ${assignedCount} resource assignments`
                              : 'Confirm delete project'
                          }
                        >
                          {assignedCount > 0 ? `Confirm (${assignedCount}p)` : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded border text-[10px]"
                          style={{ borderColor: 'var(--border-strong)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedProjectForPopover(project.id)}
                          className="px-2 py-1 rounded border text-[11px] font-medium flex items-center gap-1 hover:opacity-85"
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            borderColor: 'var(--border-strong)',
                            color: 'var(--accent-primary)'
                          }}
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          Details
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(project.id)}
                          aria-label={`Delete ${project.name}`}
                          className="p-1 rounded hover:opacity-75"
                          style={{ color: 'var(--status-overrun)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-1.5 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

/**
 * 3. Dedicated All Resources Editable Table Screen ('manage-people')
 */
const ManageAllPeopleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    dataset,
    updatePerson,
    deletePerson,
    addPeople,
    upsertTimeOff,
    removeTimeOff
  } = useDeckStore()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addingTimeOffForId, setAddingTimeOffForId] = useState<string | null>(null)
  const [timeOffReason, setTimeOffReason] = useState('Vacation')
  const horizonMonths = getHorizonMonths(dataset)
  const defaultMonth = horizonMonths[0]?.yearMonth || '2026-06'
  const [timeOffStart, setTimeOffStart] = useState(`${defaultMonth}-15`)
  const [timeOffEnd, setTimeOffEnd] = useState(`${defaultMonth}-19`)

  const uniqueRoles = Array.from(new Set(dataset.people.map((p) => p.role)))

  const filteredPeople = dataset.people.filter((p) => {
    if (roleFilter !== 'ALL' && p.role !== roleFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleAddPersonRow = (): void => {
    addPeople([
      {
        name: `New Resource ${dataset.people.length + 1}`,
        isPlaceholder: false,
        role: 'Senior Engineer',
        department: 'Engineering',
        skills: [],
        hoursPerDay: 8,
        hourlyRate: 115,
        costType: 'project_default',
        startDate: null,
        endDate: null,
        meta: {}
      }
    ])
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="View and Edit All Resources"
      onClick={(e) => e.stopPropagation()}
      className="w-[95vw] max-w-6xl h-[86vh] rounded-md border p-6 shadow-2xl flex flex-col gap-4 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <Table2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              View &amp; Edit All Resources ({dataset.people.length})
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Edit names, roles, hours, rates, hire dates, and Time Off across your entire team at once.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              aria-label="Search people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, dept..."
              className="bg-transparent focus:outline-none w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <option value="ALL">All Roles ({dataset.people.length})</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={handleAddPersonRow}
            className="px-3 py-1.5 rounded text-xs font-semibold text-white flex items-center gap-1"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Resource
          </button>

          <button
            onClick={onClose}
            aria-label="Close all resources table"
            className="p-1.5 rounded hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editable Table */}
      <div className="flex-1 overflow-auto rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr
              className="border-b text-left sticky top-0 z-10"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <th className="py-2.5 px-2.5 font-semibold min-w-[190px]">Name</th>
              <th className="py-2.5 px-2 font-semibold w-14 text-center">TBD</th>
              <th className="py-2.5 px-2.5 font-semibold w-40">Role</th>
              <th className="py-2.5 px-2.5 font-semibold w-36">Department</th>
              <th className="py-2.5 px-2.5 font-semibold w-24">Hrs/Day</th>
              <th className="py-2.5 px-2.5 font-semibold w-28">Rate ($/hr)</th>
              <th className="py-2.5 px-2.5 font-semibold w-34">Hire Date</th>
              <th className="py-2.5 px-2.5 font-semibold min-w-[220px]">Time Off</th>
              <th className="py-2.5 px-2.5 font-semibold w-28 text-right">Remove</th>
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map((person) => {
              const personTimeOff = dataset.timeOff.filter(
                (t) => t.personId === person.id
              )
              const assignedProjectsCount = dataset.assignments.filter(
                (a) => a.personId === person.id
              ).length
              return (
                <tr
                  key={person.id}
                  className="border-b align-top"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="p-1.5">
                    <input
                      aria-label="Resource name"
                      value={person.name}
                      onChange={(e) =>
                        updatePerson(person.id, { name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs font-semibold"
                    />
                  </td>
                  <td className="p-1.5 text-center pt-3">
                    <input
                      type="checkbox"
                      aria-label={`Mark ${person.name} as TBD`}
                      checked={person.isPlaceholder}
                      onChange={(e) =>
                        updatePerson(person.id, {
                          isPlaceholder: e.target.checked
                        })
                      }
                      className="rounded-none cursor-pointer"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="Role"
                      value={person.role}
                      onChange={(e) =>
                        updatePerson(person.id, { role: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="Department"
                      value={person.department}
                      onChange={(e) =>
                        updatePerson(person.id, { department: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      aria-label="Hours per day"
                      value={person.hoursPerDay}
                      onChange={(e) =>
                        updatePerson(person.id, {
                          hoursPerDay: Math.max(
                            1,
                            Math.min(24, Number(e.target.value) || 8)
                          )
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs font-semibold tabular-nums"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Hourly rate"
                      value={formatCommaInput(person.hourlyRate)}
                      onChange={(e) =>
                        updatePerson(person.id, {
                          hourlyRate: parseCommaInput(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs font-semibold tabular-nums text-right"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="date"
                      aria-label="Hire date"
                      value={person.startDate || ''}
                      onChange={(e) =>
                        updatePerson(person.id, {
                          startDate: e.target.value.trim() || null
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-transparent bg-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] focus:bg-[var(--bg-elevated)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-xs tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {personTimeOff.map((pto) => (
                          <span
                            key={pto.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-subtle)'
                            }}
                          >
                            <span>
                              {pto.reason}: {pto.startDate.slice(5)}→{pto.endDate.slice(5)}
                            </span>
                            <button
                              onClick={() => removeTimeOff(pto.id)}
                              className="hover:underline"
                              style={{ color: 'var(--status-overrun)' }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() =>
                            setAddingTimeOffForId(
                              addingTimeOffForId === person.id ? null : person.id
                            )
                          }
                          className="px-2 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1"
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

                      {addingTimeOffForId === person.id && (
                        <div
                          className="p-2 rounded border space-y-1.5 mt-1"
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            borderColor: 'var(--border-strong)'
                          }}
                        >
                          <input
                            value={timeOffReason}
                            onChange={(e) => setTimeOffReason(e.target.value)}
                            placeholder="Reason (e.g. Vacation)"
                            className="w-full px-2 py-1 rounded border text-[11px] bg-transparent"
                            style={{ borderColor: 'var(--border-strong)' }}
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="date"
                              value={timeOffStart}
                              onChange={(e) => setTimeOffStart(e.target.value)}
                              className="px-1.5 py-1 rounded border text-[10px] bg-transparent tabular-nums"
                              style={{ borderColor: 'var(--border-strong)' }}
                            />
                            <input
                              type="date"
                              value={timeOffEnd}
                              onChange={(e) => setTimeOffEnd(e.target.value)}
                              className="px-1.5 py-1 rounded border text-[10px] bg-transparent tabular-nums"
                              style={{ borderColor: 'var(--border-strong)' }}
                            />
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setAddingTimeOffForId(null)}
                              className="px-2 py-0.5 text-[10px]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                upsertTimeOff({
                                  personId: person.id,
                                  reason: timeOffReason.trim() || 'Time Off',
                                  startDate: timeOffStart,
                                  endDate:
                                    timeOffEnd >= timeOffStart
                                      ? timeOffEnd
                                      : timeOffStart,
                                  hoursPerDayOff: person.hoursPerDay
                                })
                                setAddingTimeOffForId(null)
                              }}
                              className="px-2.5 py-0.5 rounded text-[10px] font-semibold text-white"
                              style={{ backgroundColor: 'var(--accent-primary)' }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-right pt-2.5">
                    {confirmDeleteId === person.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            deletePerson(person.id)
                            setConfirmDeleteId(null)
                          }}
                          className="px-2 py-1 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                          style={{ backgroundColor: 'var(--status-overrun)' }}
                          title={
                            assignedProjectsCount > 0
                              ? `Removes resource and ${assignedProjectsCount} project assignments`
                              : 'Confirm remove resource'
                          }
                        >
                          {assignedProjectsCount > 0
                            ? `Confirm (${assignedProjectsCount}p)`
                            : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-1 rounded border text-[10px]"
                          style={{ borderColor: 'var(--border-strong)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(person.id)}
                        aria-label={`Remove ${person.name}`}
                        className="p-1 rounded hover:opacity-75"
                        style={{ color: 'var(--status-overrun)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-1.5 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

/**
 * 4. Add Projects Modal (Comma-formatted cost input, no ROI score)
 */
const AddProjectsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dataset, addProjects } = useDeckStore()
  const horizonMonths = getHorizonMonths(dataset)
  const firstMonth = horizonMonths[0]?.yearMonth || '2026-06'
  const thirdMonth = horizonMonths[2]?.yearMonth || '2026-08'
  const secondMonth = horizonMonths[1]?.yearMonth || '2026-07'
  const fourthMonth = horizonMonths[3]?.yearMonth || '2026-09'

  const [rows, setRows] = useState([
    {
      name: '',
      startDate: `${firstMonth}-01`,
      endDate: `${thirdMonth}-28`,
      fixedCost: '65,000',
      certainty: 'confirmed' as Project['certainty']
    },
    {
      name: '',
      startDate: `${secondMonth}-06`,
      endDate: `${fourthMonth}-25`,
      fixedCost: '45,000',
      certainty: 'confirmed' as Project['certainty']
    }
  ])
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null)

  const handleBulkPaste = (): void => {
    if (!pasteText.trim()) return
    const parsed = Papa.parse<string[]>(pasteText.trim(), { skipEmptyLines: true })
    let defaultedCount = 0
    const importedRows = parsed.data
      .filter((r) => r.length >= 1 && r[0].trim().toLowerCase() !== 'project name')
      .map((r) => {
        const rawStart = r[1]?.trim()
        const rawEnd = r[2]?.trim()
        const rawCost = parseCommaInput(r[3] || '')
        const validStart = rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart)
        const validEnd = rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd)
        if (!validStart || !validEnd || !rawCost) defaultedCount++

        return {
          name: r[0]?.trim() || 'Imported Project',
          startDate: validStart ? rawStart : `${firstMonth}-01`,
          endDate: validEnd ? rawEnd : `${thirdMonth}-28`,
          fixedCost: formatCommaInput(rawCost > 0 ? rawCost : 50000),
          certainty: (r[4]?.toLowerCase().includes('tent')
            ? 'tentative'
            : 'confirmed') as Project['certainty']
        }
      })

    if (importedRows.length > 0) {
      setRows(importedRows)
      setPasteBoxOpen(false)
      setPasteText('')
      setPasteFeedback(
        defaultedCount > 0
          ? `Imported ${importedRows.length} rows (${defaultedCount} row${defaultedCount === 1 ? '' : 's'} used default dates/cost — please review below).`
          : `Imported ${importedRows.length} project row${importedRows.length === 1 ? '' : 's'}.`
      )
    }
  }

  const handleSubmit = (): void => {
    const valid = rows.filter((r) => r.name.trim().length > 0)
    if (valid.length === 0) {
      onClose()
      return
    }
    addProjects(
      valid.map((r, i) => ({
        name: r.name.trim(),
        startDate: r.startDate,
        endDate: r.endDate >= r.startDate ? r.endDate : r.startDate,
        status: 'on_deck',
        certainty: r.certainty,
        priorityRank: i + 1,
        valueScore: 75,
        costMode: 'fixed',
        fixedCost: parseCommaInput(r.fixedCost),
        capexPercent: 70,
        blendedHourlyRate: 115,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        meta: {}
      }))
    )
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Projects to Deck"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-3xl rounded-md border p-6 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <FolderPlus className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              Add Projects to Deck
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Stages projects in &ldquo;Projects on Deck&rdquo;, ready to drag onto the timeline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPasteBoxOpen(!pasteBoxOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Excel / CSV
          </button>
          <button
            onClick={onClose}
            aria-label="Close add projects dialog"
            className="p-1 rounded hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pasteFeedback && (
        <div
          role="status"
          className="px-3 py-2 rounded border text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--accent-primary)',
            color: 'var(--text-primary)'
          }}
        >
          {pasteFeedback}
        </div>
      )}

      {pasteBoxOpen && (
        <div
          className="p-3 rounded border space-y-2"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)'
          }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Paste rows from Excel/Sheets or CSV in format:{' '}
            <code>Project Name, YYYY-MM-DD (Start), YYYY-MM-DD (End), Cost</code>
          </p>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Data Warehouse Upgrade, ${firstMonth}-01, ${thirdMonth}-28, 85000\nCustomer Portal v3, ${secondMonth}-15, ${fourthMonth}-15, 62000`}
            className="w-full p-2 rounded border text-xs font-mono"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)'
            }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleBulkPaste}
              className="px-3 py-1 rounded text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Parse Rows
            </button>
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div
        className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <div className="col-span-4">Project Name</div>
        <div className="col-span-2">Start Date</div>
        <div className="col-span-2">End Date</div>
        <div className="col-span-2">Cost ($)</div>
        <div className="col-span-2">Pipeline</div>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              aria-label={`Project ${idx + 1} name`}
              placeholder={`Project ${String.fromCharCode(65 + idx)}`}
              value={row.name}
              onChange={(e) => {
                const next = [...rows]
                next[idx].name = e.target.value
                setRows(next)
              }}
              className="col-span-4 px-2.5 py-1.5 rounded border text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="date"
              aria-label={`Project ${idx + 1} start date`}
              value={row.startDate}
              onChange={(e) => {
                const next = [...rows]
                next[idx].startDate = e.target.value
                setRows(next)
              }}
              className="col-span-2 px-2 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="date"
              aria-label={`Project ${idx + 1} end date`}
              value={row.endDate}
              onChange={(e) => {
                const next = [...rows]
                next[idx].endDate = e.target.value
                setRows(next)
              }}
              className="col-span-2 px-2 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label={`Project ${idx + 1} cost`}
              value={row.fixedCost}
              onChange={(e) => {
                const next = [...rows]
                next[idx].fixedCost = formatCommaInput(e.target.value)
                setRows(next)
              }}
              className="col-span-2 px-2.5 py-1.5 rounded border text-xs font-semibold tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <div className="col-span-2 flex items-center gap-1">
              <select
                aria-label={`Project ${idx + 1} pipeline certainty`}
                value={row.certainty}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx].certainty = e.target.value as Project['certainty']
                  setRows(next)
                }}
                className="flex-1 px-2 py-1.5 rounded border text-xs"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <option value="confirmed">Confirmed</option>
                <option value="tentative">Tentative</option>
              </select>
              {rows.length > 1 && (
                <button
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                  aria-label={`Remove project row ${idx + 1}`}
                  className="p-1 hover:opacity-80"
                  style={{ color: 'var(--status-overrun)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() =>
            setRows([
              ...rows,
              {
                name: '',
                startDate: `${thirdMonth}-03`,
                endDate: `${fourthMonth}-28`,
                fixedCost: '50,000',
                certainty: 'confirmed'
              }
            ])
          }
          className="text-xs font-semibold hover:underline flex items-center gap-1"
          style={{ color: 'var(--accent-primary)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Project Line
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border text-xs font-medium"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-1.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Add Projects
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 5. Add People / Resources Modal (Removed unused Skills field, comma-formatted hourly rate)
 */
const AddPeopleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addPeople } = useDeckStore()
  const [rows, setRows] = useState([
    {
      name: '',
      role: 'Senior Engineer',
      department: 'Engineering',
      hoursPerDay: '8',
      hourlyRate: '115',
      isPlaceholder: false,
      startDate: ''
    },
    {
      name: '',
      role: 'Product Designer',
      department: 'Design',
      hoursPerDay: '8',
      hourlyRate: '100',
      isPlaceholder: false,
      startDate: ''
    }
  ])
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null)

  const handleBulkPaste = (): void => {
    if (!pasteText.trim()) return
    const parsed = Papa.parse<string[]>(pasteText.trim(), { skipEmptyLines: true })
    const imported = parsed.data
      .filter((r) => r.length >= 1 && r[0].trim().toLowerCase() !== 'name')
      .map((r) => ({
        name: r[0]?.trim() || 'Team Member',
        hoursPerDay: String(Number(r[1]) || 8),
        role: r[2]?.trim() || 'Engineer',
        department: r[3]?.trim() || 'Engineering',
        hourlyRate: formatCommaInput(parseCommaInput(r[4] || '110')),
        isPlaceholder: r[0]?.toUpperCase().includes('TBD') || false,
        startDate: r[5]?.trim() || ''
      }))

    if (imported.length > 0) {
      setRows(imported)
      setPasteBoxOpen(false)
      setPasteText('')
      setPasteFeedback(`Imported ${imported.length} roster row${imported.length === 1 ? '' : 's'}.`)
    }
  }

  const handleSubmit = (): void => {
    const valid = rows.filter((r) => r.name.trim().length > 0)
    if (valid.length === 0) {
      onClose()
      return
    }
    addPeople(
      valid.map((r) => ({
        name: r.name.trim(),
        isPlaceholder: r.isPlaceholder,
        role: r.role.trim() || 'General',
        department: r.department.trim() || 'Delivery',
        skills: [],
        hoursPerDay: Math.max(1, Math.min(24, Number(r.hoursPerDay) || 8)),
        hourlyRate: parseCommaInput(r.hourlyRate),
        costType: 'project_default' as Person['costType'],
        startDate: r.startDate.trim() || null,
        endDate: null,
        meta: {}
      }))
    )
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add People and Role Placeholders"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-4xl rounded-md border p-6 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <UserPlus className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              Add People &amp; Role Placeholders
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Feeds the capacity target line and adds people to the sidebar to drag onto timeline projects.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPasteBoxOpen(!pasteBoxOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste Roster from Excel / CSV
          </button>
          <button
            onClick={onClose}
            aria-label="Close add people dialog"
            className="p-1 rounded hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pasteFeedback && (
        <div
          role="status"
          className="px-3 py-2 rounded border text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--accent-secondary)',
            color: 'var(--text-primary)'
          }}
        >
          {pasteFeedback}
        </div>
      )}

      {pasteBoxOpen && (
        <div
          className="p-3 rounded border space-y-2"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)'
          }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Paste rows in format: <code>Name, HoursPerDay, Role, Department, HourlyRate</code>
          </p>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Maya Patel, 8, Staff Engineer, Engineering, 130\nTBD Cloud Architect, 8, Principal Engineer, Engineering, 140`}
            className="w-full p-2 rounded border text-xs font-mono"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)'
            }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleBulkPaste}
              className="px-3 py-1 rounded text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-secondary)' }}
            >
              Parse Roster
            </button>
          </div>
        </div>
      )}

      <div
        className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <div className="col-span-3">Name / TBD Placeholder</div>
        <div className="col-span-2">Hours / Day</div>
        <div className="col-span-2">Role</div>
        <div className="col-span-2">Rate ($/hr)</div>
        <div className="col-span-2">Hire Date (Opt)</div>
        <div className="col-span-1 text-center">TBD?</div>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              aria-label={`Person ${idx + 1} name`}
              placeholder={row.isPlaceholder ? 'TBD Senior Dev' : 'Full Name'}
              value={row.name}
              onChange={(e) => {
                const next = [...rows]
                next[idx].name = e.target.value
                setRows(next)
              }}
              className="col-span-3 px-2.5 py-1.5 rounded border text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="number"
              aria-label={`Person ${idx + 1} hours per day`}
              value={row.hoursPerDay}
              onChange={(e) => {
                const next = [...rows]
                next[idx].hoursPerDay = e.target.value
                setRows(next)
              }}
              className="col-span-2 px-2.5 py-1.5 rounded border text-xs font-semibold tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              aria-label={`Person ${idx + 1} role`}
              placeholder="Role"
              value={row.role}
              onChange={(e) => {
                const next = [...rows]
                next[idx].role = e.target.value
                setRows(next)
              }}
              className="col-span-2 px-2.5 py-1.5 rounded border text-xs"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label={`Person ${idx + 1} hourly rate`}
              value={row.hourlyRate}
              onChange={(e) => {
                const next = [...rows]
                next[idx].hourlyRate = formatCommaInput(e.target.value)
                setRows(next)
              }}
              className="col-span-2 px-2.5 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="date"
              aria-label={`Person ${idx + 1} hire date`}
              value={row.startDate}
              onChange={(e) => {
                const next = [...rows]
                next[idx].startDate = e.target.value
                setRows(next)
              }}
              className="col-span-2 px-2 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <div className="col-span-1 flex items-center justify-center gap-1">
              <input
                type="checkbox"
                aria-label={`Mark person ${idx + 1} as TBD placeholder`}
                checked={row.isPlaceholder}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx].isPlaceholder = e.target.checked
                  setRows(next)
                }}
                className="rounded-none"
                title="Mark as To-Be-Hired (TBD) Role Placeholder"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                  aria-label={`Remove person row ${idx + 1}`}
                  style={{ color: 'var(--status-overrun)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() =>
            setRows([
              ...rows,
              {
                name: '',
                role: 'Engineer',
                department: 'Engineering',
                hoursPerDay: '8',
                hourlyRate: '110',
                isPlaceholder: false,
                startDate: ''
              }
            ])
          }
          className="text-xs font-semibold hover:underline flex items-center gap-1"
          style={{ color: 'var(--accent-secondary)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Person Line
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border text-xs font-medium"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-1.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-secondary)' }}
          >
            Add People
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 6. Company-Wide Holiday Calendar Modal
 */
const HolidaysModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dataset, setHolidays } = useDeckStore()
  const horizonMonths = getHorizonMonths(dataset)
  const defaultHolidayMonth = horizonMonths[0]?.yearMonth || '2026-06'
  const defaultYear = horizonMonths[0]?.year || 2026

  const [list, setList] = useState(
    dataset.holidays.map((h) => ({
      name: h.name,
      startDate: h.startDate,
      endDate: h.endDate
    }))
  )

  const loadUsHolidaysPreset = (): void => {
    setList([
      { name: "New Year's Day", startDate: `${defaultYear}-01-01`, endDate: `${defaultYear}-01-01` },
      { name: 'MLK Jr. Day', startDate: `${defaultYear}-01-19`, endDate: `${defaultYear}-01-19` },
      { name: "Presidents' Day", startDate: `${defaultYear}-02-16`, endDate: `${defaultYear}-02-16` },
      { name: 'Memorial Day', startDate: `${defaultYear}-05-25`, endDate: `${defaultYear}-05-25` },
      { name: 'Juneteenth', startDate: `${defaultYear}-06-19`, endDate: `${defaultYear}-06-19` },
      { name: 'Independence Day (Observed)', startDate: `${defaultYear}-07-03`, endDate: `${defaultYear}-07-03` },
      { name: 'Labor Day', startDate: `${defaultYear}-09-07`, endDate: `${defaultYear}-09-07` },
      { name: 'Thanksgiving Break', startDate: `${defaultYear}-11-26`, endDate: `${defaultYear}-11-27` },
      { name: 'Year-End Company Shutdown', startDate: `${defaultYear}-12-24`, endDate: `${defaultYear}-12-31` }
    ])
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Company-Wide Holiday Schedule"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-2xl rounded-md border p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <CalendarOff className="w-5 h-5" style={{ color: 'var(--status-bench)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              Company-Wide Holiday Schedule
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Automatically deducts company holidays and shutdown weeks from monthly weekday capacity.
            </p>
          </div>
        </div>
        <button
          onClick={loadUsHolidaysPreset}
          className="px-2.5 py-1 rounded border text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)'
          }}
        >
          Load US Federal + Shutdown Preset
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {list.map((h, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input
              aria-label={`Holiday ${i + 1} name`}
              value={h.name}
              onChange={(e) => {
                const next = [...list]
                next[i].name = e.target.value
                setList(next)
              }}
              placeholder="Holiday Name"
              className="col-span-5 px-2.5 py-1.5 rounded border text-xs"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="date"
              aria-label={`Holiday ${i + 1} start date`}
              value={h.startDate}
              onChange={(e) => {
                const next = [...list]
                next[i].startDate = e.target.value
                if (next[i].endDate < e.target.value) next[i].endDate = e.target.value
                setList(next)
              }}
              className="col-span-3 px-2 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <input
              type="date"
              aria-label={`Holiday ${i + 1} end date`}
              value={h.endDate}
              onChange={(e) => {
                const next = [...list]
                next[i].endDate = e.target.value
                setList(next)
              }}
              className="col-span-3 px-2 py-1.5 rounded border text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            />
            <button
              onClick={() => setList(list.filter((_, idx) => idx !== i))}
              aria-label={`Remove holiday ${h.name || i + 1}`}
              className="col-span-1 flex justify-center"
              style={{ color: 'var(--status-overrun)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() =>
            setList([
              ...list,
              {
                name: 'Company Holiday',
                startDate: `${defaultHolidayMonth}-15`,
                endDate: `${defaultHolidayMonth}-15`
              }
            ])
          }
          className="text-xs font-semibold hover:underline flex items-center gap-1"
          style={{ color: 'var(--accent-primary)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Holiday / Shutdown Window
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border text-xs"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setHolidays(list.filter((h) => h.name.trim().length > 0))
              onClose()
            }}
            className="px-5 py-1.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Save Holiday Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 7. AI Data Bridge Modal
 */
const AiBridgeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dataset, baselineDataset, filePath } = useDeckStore()
  const [pack, setPack] = useState<{
    markdownPromptPack: string
    jsonBundle: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (window.rdeck) {
      void window.rdeck
        .generateAiContextPack(dataset.scenario.id)
        .then((res) =>
          setPack({
            markdownPromptPack: res.markdownPromptPack,
            jsonBundle: res.jsonBundle
          })
        )
    } else {
      setPack(generateAiContextPack(dataset, baselineDataset))
    }
  }, [dataset, baselineDataset])

  const handleCopyPromptPack = (): void => {
    if (!pack) return
    void navigator.clipboard.writeText(pack.markdownPromptPack)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportJson = async (): Promise<void> => {
    if (!pack || !window.rdeck) return
    await window.rdeck.exportTextFile(
      `${dataset.scenario.name.replace(/\s+/g, '-')}.ai-context.json`,
      pack.jsonBundle
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Data Bridge"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-3xl rounded-md border p-6 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="font-editorial text-lg font-semibold">
              AI Data Bridge (ChatGPT, Claude Cowork, Gemini)
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Your <code>.rdeck</code> file is an open, self-documenting SQLite database with pre-computed views.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close AI Data Bridge dialog"
          className="p-1 rounded hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Direct SQLite File Info */}
      <div
        className="p-3.5 rounded border space-y-1.5 text-xs"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="font-semibold">
          Option 1: Direct <code>.rdeck</code> File Access (Claude Cowork / ChatGPT Data Analysis)
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Point your local AI agent or upload your <code>.rdeck</code> file directly. It includes an{' '}
          <code>_ai_readme</code> table, <code>ai_monthly_rollup</code>, and SQL views (<code>v_ai_project_schedule</code>, <code>v_ai_person_allocations</code>, <code>v_ai_scenario_comparison</code>).
        </p>
        <div
          className="px-2.5 py-1.5 rounded border font-mono text-[11px] break-all"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          {filePath}
        </div>
      </div>

      {/* Markdown Context Pack Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">
            Option 2: One-Click AI Context Pack (Markdown + Monthly Rollup Table)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleExportJson()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export Full JSON Bundle
            </button>
            <button
              onClick={handleCopyPromptPack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied to Clipboard
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy AI Context Pack
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          readOnly
          aria-label="Generated AI Markdown context pack"
          rows={10}
          value={pack?.markdownPromptPack || 'Generating AI Context Pack...'}
          className="w-full p-3 rounded border text-xs font-mono leading-relaxed"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        />
      </div>
    </div>
  )
}

/**
 * 8. Create New What-If Scenario Modal
 */
const NewScenarioModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dataset, createWhatIfScenario } = useDeckStore()
  const [name, setName] = useState(`What-If: Q3 Adjustment`)
  const [desc, setDesc] = useState(
    `Forked from ${dataset.scenario.name} to model schedule & staffing alternatives`
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create What-If Scenario Branch"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md rounded-md border p-6 shadow-xl space-y-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="font-editorial text-base font-semibold">
            Create &ldquo;What-If&rdquo; Scenario Branch
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close create scenario dialog"
          className="p-1 rounded hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <p style={{ color: 'var(--text-secondary)' }}>
          Forking <strong>{dataset.scenario.name}</strong> creates an isolated derivative plan. You can shift project timelines, adjust budgets, or add hires—and see live ghost bars and financial diffs against the Baseline.
        </p>

        <div>
          <label className="font-semibold block mb-1">Scenario Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 rounded border text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          />
        </div>

        <div>
          <label className="font-semibold block mb-1">Hypothesis / Notes</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-1.5 rounded border text-xs"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)'
            }}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded border text-xs"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return
            void createWhatIfScenario(name.trim(), desc.trim())
          }}
          className="px-5 py-1.5 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Fork Scenario
        </button>
      </div>
    </div>
  )
}
