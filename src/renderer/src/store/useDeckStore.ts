import { create } from 'zustand'
import { temporal } from 'zundo'
import { addBusinessDays } from 'date-fns'
import type {
  Assignment,
  ChartFilterScope,
  Dependency,
  Holiday,
  Milestone,
  MonthlyBudget,
  Person,
  Project,
  Scenario,
  ScenarioDataset,
  ThemeId,
  TimeOff
} from '../../../shared/types'
import { parseLocalDate, toIsoDate } from '../../../shared/engine/calculator'
import { createSamplePortfolio } from '../../../shared/engine/sampleData'

export type WorkspaceViewMode = 'dashboard' | 'split-timeline' | 'heatmap'

export interface DeckState {
  // File & Session
  isLoaded: boolean
  filePath: string
  recentFiles: string[]
  lastSavedAt: string | null
  isSaving: boolean

  // Scenarios
  scenarios: Scenario[]
  dataset: ScenarioDataset
  baselineDataset: ScenarioDataset

  // Workspace UI & Presentation State
  viewMode: WorkspaceViewMode
  isTimelineOpen: boolean
  isChartsMinimized: boolean
  isPresentationMode: boolean
  isDiffDrawerOpen: boolean
  showGhostBars: boolean
  theme: ThemeId
  zoomMonths: number // How many months visible or zoom scale (1 = standard, 1.5 = wide, 0.75 = compact)
  focusedProjectId: string | null
  selectedProjectForPopover: string | null

  // Chart Filter State
  chartFilter: ChartFilterScope

  // Active Modal State
  activeModal:
    | null
    | 'budgets'
    | 'add-projects'
    | 'add-people'
    | 'manage-projects'
    | 'manage-people'
    | 'holidays'
    | 'ai-bridge'
    | 'new-scenario'

  // Multi-Person Selection State (for dragging multiple people as a stacked deck onto a project)
  selectedPersonIds: string[]

  // Quick Assignment Prompt (When dragging one or more People onto a Project bar)
  pendingDropAssignment: {
    projectId: string
    personIds: string[]
  } | null

  // Session Actions
  initializeSession: () => Promise<void>
  openFileByPath: (path: string) => Promise<void>
  openFileDialog: () => Promise<void>
  saveFileAsDialog: () => Promise<void>
  createNewBlankFile: () => Promise<void>
  resetToSamplePortfolio: () => Promise<void>

  // Scenario Actions
  switchScenario: (scenarioId: string) => Promise<void>
  createWhatIfScenario: (name: string, description?: string) => Promise<void>
  promoteCurrentToBaseline: () => Promise<void>
  deleteCurrentScenario: () => Promise<void>

  // UI & Theme Actions
  setViewMode: (mode: WorkspaceViewMode) => void
  toggleTimelineOpen: () => void
  setChartsMinimized: (minimized: boolean) => void
  toggleChartsMinimized: () => void
  togglePresentationMode: () => void
  setDiffDrawerOpen: (open: boolean) => void
  setShowGhostBars: (show: boolean) => void
  setTheme: (theme: ThemeId) => void
  setZoomMonths: (zoom: number) => void
  setFocusedProjectId: (id: string | null) => void
  setSelectedProjectForPopover: (id: string | null) => void
  setChartFilter: (partial: Partial<ChartFilterScope>) => void
  setActiveModal: (modal: DeckState['activeModal']) => void
  toggleSelectPerson: (personId: string) => void
  setSelectedPersonIds: (ids: string[]) => void
  clearSelectedPeople: () => void
  setPendingDropAssignment: (pending: DeckState['pendingDropAssignment']) => void

  // Data Mutation Actions (All trigger instant SQLite .rdeck auto-save)
  upsertBudgets: (budgets: MonthlyBudget[]) => void
  addProjects: (projects: Omit<Project, 'id' | 'scenarioId'>[]) => void
  updateProject: (projectId: string, patch: Partial<Project>) => void
  deleteProject: (projectId: string) => void
  moveProjectStatus: (projectId: string, status: Project['status']) => void
  shiftProjectByBusinessDays: (
    projectId: string,
    deltaBusinessDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
    autoShiftDependents?: boolean
  ) => void

  addPeople: (people: Omit<Person, 'id' | 'scenarioId'>[]) => void
  updatePerson: (personId: string, patch: Partial<Person>) => void
  deletePerson: (personId: string) => void

  upsertAssignment: (
    projectId: string,
    personId: string,
    allocationValue: number,
    allocationMode?: Assignment['allocationMode'],
    requiredRole?: string,
    requiredSkills?: string[]
  ) => void
  upsertMultipleAssignments: (
    projectId: string,
    entries: {
      personId: string
      allocationValue: number
      allocationMode: Assignment['allocationMode']
      requiredRole?: string
      requiredSkills?: string[]
    }[]
  ) => void
  removeAssignment: (assignmentId: string) => void

  addMilestone: (milestone: Omit<Milestone, 'id' | 'scenarioId'>) => void
  removeMilestone: (milestoneId: string) => void

  addDependency: (fromProjectId: string, toProjectId: string) => void
  removeDependency: (dependencyId: string) => void

  setHolidays: (holidays: Omit<Holiday, 'id' | 'scenarioId'>[]) => void
  upsertTimeOff: (timeOff: Omit<TimeOff, 'id' | 'scenarioId'> & { id?: string }) => void
  removeTimeOff: (timeOffId: string) => void
}

const initialSample = createSamplePortfolio()

function applyThemeToDom(theme: ThemeId): void {
  localStorage.setItem('rdeck-theme', theme)
  const lightThemes = ['boardroom-daylight', 'warm-paper', 'nordic-frost']
  let resolved = theme
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'executive-slate'
      : 'boardroom-daylight'
  }
  document.documentElement.setAttribute('data-theme', resolved)
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) {
    meta.setAttribute('content', lightThemes.includes(resolved) ? 'light' : 'dark')
  }
}

export const useDeckStore = create<DeckState>()(
  temporal(
    (set, get) => {
      let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

      const persistDataset = (nextDataset: ScenarioDataset): void => {
        // 1. Update in-memory state immediately in a single synchronous pass (keeps WeakMap caches warm)
        set((state) => ({
          dataset: nextDataset,
          baselineDataset: nextDataset.scenario.isBaseline
            ? nextDataset
            : state.baselineDataset
        }))

        // 2. Debounce SQLite IPC disk persistence so rapid typing / dragging never blocks UI or triggers redundant re-renders
        if (saveDebounceTimer) {
          clearTimeout(saveDebounceTimer)
        }

        if (window.rdeck) {
          saveDebounceTimer = setTimeout(async () => {
            set({ isSaving: true })
            try {
              const res = await window.rdeck.saveScenarioDataset(nextDataset)
              set({
                lastSavedAt: res.savedAt,
                isSaving: false
              })
            } catch (err) {
              console.error('Auto-save failed:', err)
              set({ isSaving: false })
            }
          }, 160)
        } else {
          set({
            lastSavedAt: new Date().toISOString()
          })
        }
      }

      return {
        isLoaded: false,
        filePath: 'Sample-Executive-Plan.rdeck',
        recentFiles: [],
        lastSavedAt: new Date().toISOString(),
        isSaving: false,

        scenarios: [initialSample.baseline.scenario, initialSample.whatIf.scenario],
        dataset: initialSample.baseline,
        baselineDataset: initialSample.baseline,

        viewMode: 'split-timeline',
        isTimelineOpen: true,
        isChartsMinimized: false,
        isPresentationMode: false,
        isDiffDrawerOpen: false,
        showGhostBars: true,
        theme: (localStorage.getItem('rdeck-theme') as ThemeId) || 'boardroom-daylight',
        zoomMonths: 1,
        focusedProjectId: null,
        selectedProjectForPopover: null,

        chartFilter: {
          type: 'all',
          value: 'all',
          includeTentative: true,
          financialBreakdown: 'total'
        },

        activeModal: null,
        selectedPersonIds: [],
        pendingDropAssignment: null,

        initializeSession: async () => {
          applyThemeToDom(get().theme)
          if (window.rdeck) {
            const res = await window.rdeck.initDefaultOrLastFile()
            set({
              isLoaded: true,
              filePath: res.filePath,
              scenarios: res.scenarios,
              dataset: res.activeScenario,
              baselineDataset: res.baselineDataset,
              recentFiles: res.recentFiles,
              lastSavedAt: new Date().toISOString()
            })
          } else {
            set({ isLoaded: true })
          }
        },

        openFileByPath: async (path: string) => {
          if (!window.rdeck) return
          const res = await window.rdeck.openFileByPath(path, false)
          set({
            filePath: res.filePath,
            scenarios: res.scenarios,
            dataset: res.activeScenario,
            baselineDataset: res.baselineDataset,
            recentFiles: res.recentFiles,
            lastSavedAt: new Date().toISOString()
          })
        },

        openFileDialog: async () => {
          if (!window.rdeck) return
          const res = await window.rdeck.showOpenDialog()
          if (!res) return
          set({
            filePath: res.filePath,
            scenarios: res.scenarios,
            dataset: res.activeScenario,
            baselineDataset: res.baselineDataset,
            recentFiles: res.recentFiles,
            lastSavedAt: new Date().toISOString()
          })
        },

        saveFileAsDialog: async () => {
          if (!window.rdeck) return
          const res = await window.rdeck.showSaveAsDialog()
          if (!res) return
          set({
            filePath: res.filePath,
            scenarios: res.scenarios,
            dataset: res.activeScenario,
            baselineDataset: res.baselineDataset,
            recentFiles: res.recentFiles,
            lastSavedAt: new Date().toISOString()
          })
        },

        createNewBlankFile: async () => {
          if (!window.rdeck) return
          const res = await window.rdeck.createNewBlankFile()
          if (!res) return
          set({
            filePath: res.filePath,
            scenarios: res.scenarios,
            dataset: res.activeScenario,
            baselineDataset: res.baselineDataset,
            recentFiles: res.recentFiles,
            lastSavedAt: new Date().toISOString()
          })
        },

        resetToSamplePortfolio: async () => {
          if (!window.rdeck) {
            const fresh = createSamplePortfolio()
            set({
              scenarios: [fresh.baseline.scenario, fresh.whatIf.scenario],
              dataset: fresh.baseline,
              baselineDataset: fresh.baseline,
              selectedPersonIds: []
            })
            return
          }
          const res = await window.rdeck.resetToSamplePortfolio()
          set({
            filePath: res.filePath,
            scenarios: res.scenarios,
            dataset: res.activeScenario,
            baselineDataset: res.baselineDataset,
            recentFiles: res.recentFiles,
            lastSavedAt: new Date().toISOString(),
            selectedPersonIds: []
          })
        },

        switchScenario: async (scenarioId: string) => {
          if (window.rdeck) {
            const res = await window.rdeck.loadScenario(scenarioId)
            set({
              scenarios: res.scenarios,
              dataset: res.activeScenario,
              baselineDataset: res.baselineDataset,
              selectedProjectForPopover: null,
              selectedPersonIds: []
            })
          }
        },

        createWhatIfScenario: async (name: string, description = '') => {
          const currentId = get().dataset.scenario.id
          if (window.rdeck) {
            const res = await window.rdeck.duplicateScenario(currentId, name, description)
            set({
              scenarios: res.scenarios,
              dataset: res.activeScenario,
              baselineDataset: res.baselineDataset,
              activeModal: null
            })
          } else {
            const newId = `scen-${Date.now()}`
            const cur = get().dataset
            const forked: ScenarioDataset = {
              ...cur,
              scenario: {
                id: newId,
                parentScenarioId: cur.scenario.id,
                name,
                description,
                isBaseline: false,
                createdAt: new Date().toISOString(),
                meta: {}
              }
            }
            set({
              scenarios: [...get().scenarios, forked.scenario],
              dataset: forked,
              activeModal: null
            })
          }
        },

        promoteCurrentToBaseline: async () => {
          const currentId = get().dataset.scenario.id
          if (window.rdeck) {
            const res = await window.rdeck.promoteScenarioToBaseline(currentId)
            set({
              scenarios: res.scenarios,
              dataset: res.activeScenario,
              baselineDataset: res.baselineDataset,
              isDiffDrawerOpen: false
            })
          }
        },

        deleteCurrentScenario: async () => {
          const currentId = get().dataset.scenario.id
          if (window.rdeck && get().scenarios.length > 1) {
            const res = await window.rdeck.deleteScenario(currentId)
            set({
              scenarios: res.scenarios,
              dataset: res.activeScenario,
              baselineDataset: res.baselineDataset,
              isDiffDrawerOpen: false
            })
          }
        },

        setViewMode: (mode) =>
          set((s) => ({
            viewMode: mode,
            isTimelineOpen: mode === 'split-timeline',
            isChartsMinimized: mode === 'dashboard' ? false : s.isChartsMinimized
          })),

        toggleTimelineOpen: () => {
          const nextOpen = !get().isTimelineOpen
          set((s) => ({
            isTimelineOpen: nextOpen,
            viewMode: nextOpen ? 'split-timeline' : 'dashboard',
            isChartsMinimized: nextOpen ? s.isChartsMinimized : false
          }))
        },

        setChartsMinimized: (minimized) => set({ isChartsMinimized: minimized }),

        toggleChartsMinimized: () =>
          set((s) => ({ isChartsMinimized: !s.isChartsMinimized })),

        togglePresentationMode: () =>
          set((s) => ({
            isPresentationMode: !s.isPresentationMode,
            selectedProjectForPopover: null
          })),

        setDiffDrawerOpen: (open) => set({ isDiffDrawerOpen: open }),
        setShowGhostBars: (show) => set({ showGhostBars: show }),

        setTheme: (theme) => {
          applyThemeToDom(theme)
          set({ theme })
        },

        setZoomMonths: (zoom) => set({ zoomMonths: zoom }),
        setFocusedProjectId: (id) => set({ focusedProjectId: id }),
        setSelectedProjectForPopover: (id) => set({ selectedProjectForPopover: id }),

        setChartFilter: (partial) =>
          set((s) => ({ chartFilter: { ...s.chartFilter, ...partial } })),

        setActiveModal: (modal) => set({ activeModal: modal }),

        toggleSelectPerson: (personId) =>
          set((s) => ({
            selectedPersonIds: s.selectedPersonIds.includes(personId)
              ? s.selectedPersonIds.filter((id) => id !== personId)
              : [...s.selectedPersonIds, personId]
          })),

        setSelectedPersonIds: (ids) => set({ selectedPersonIds: ids }),
        clearSelectedPeople: () => set({ selectedPersonIds: [] }),

        setPendingDropAssignment: (pending) => set({ pendingDropAssignment: pending }),

        upsertBudgets: (incomingBudgets) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          const map = new Map<string, MonthlyBudget>()
          for (const b of cur.budgets) {
            map.set(`${b.year}-${b.month}`, b)
          }
          for (const b of incomingBudgets) {
            map.set(`${b.year}-${b.month}`, { ...b, scenarioId: sid })
          }
          const updated = Array.from(map.values()).sort(
            (a, b) => a.year - b.year || a.month - b.month
          )
          void persistDataset({ ...cur, budgets: updated })
        },

        addProjects: (newProjects) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          const created: Project[] = newProjects.map((p, idx) => ({
            ...p,
            id: `proj-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            scenarioId: sid
          }))
          void persistDataset({
            ...cur,
            projects: [...cur.projects, ...created]
          })
        },

        updateProject: (projectId, patch) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            projects: cur.projects.map((p) => {
              if (p.id !== projectId) return p
              const next = { ...p, ...patch }
              if (patch.startDate && next.endDate < patch.startDate) {
                next.endDate = patch.startDate
              } else if (patch.endDate && next.startDate > patch.endDate) {
                next.startDate = patch.endDate
              }
              return next
            })
          })
        },

        deleteProject: (projectId) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            projects: cur.projects.filter((p) => p.id !== projectId),
            assignments: cur.assignments.filter((a) => a.projectId !== projectId),
            milestones: cur.milestones.filter((m) => m.projectId !== projectId),
            dependencies: cur.dependencies.filter(
              (d) => d.fromProjectId !== projectId && d.toProjectId !== projectId
            )
          })
        },

        moveProjectStatus: (projectId, status) => {
          const cur = get().dataset
          // Per 2011 spec: moving back to On Deck keeps all people assigned, hours, cost, and dates intact!
          void persistDataset({
            ...cur,
            projects: cur.projects.map((p) =>
              p.id === projectId ? { ...p, status } : p
            )
          })
        },

        shiftProjectByBusinessDays: (
          projectId,
          deltaBusinessDays,
          mode,
          autoShiftDependents = false
        ) => {
          if (deltaBusinessDays === 0) return
          const cur = get().dataset
          const target = cur.projects.find((p) => p.id === projectId)
          if (!target) return

          const start = parseLocalDate(target.startDate)
          const end = parseLocalDate(target.endDate)

          let newStart = start
          let newEnd = end

          if (mode === 'move') {
            newStart = addBusinessDays(start, deltaBusinessDays)
            newEnd = addBusinessDays(end, deltaBusinessDays)
          } else if (mode === 'resize-start') {
            const candidate = addBusinessDays(start, deltaBusinessDays)
            if (candidate < end) newStart = candidate
          } else if (mode === 'resize-end') {
            const candidate = addBusinessDays(end, deltaBusinessDays)
            if (candidate > start) newEnd = candidate
          }

          const newStartStr = toIsoDate(newStart)
          const newEndStr = toIsoDate(newEnd)

          // Optionally shift successor dependent projects
          const dependentIds = new Set<string>()
          if (autoShiftDependents && deltaBusinessDays > 0) {
            for (const dep of cur.dependencies) {
              if (dep.fromProjectId === projectId) {
                dependentIds.add(dep.toProjectId)
              }
            }
          }

          const updatedProjects = cur.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, startDate: newStartStr, endDate: newEndStr }
            }
            if (dependentIds.has(p.id)) {
              const depStart = toIsoDate(
                addBusinessDays(parseLocalDate(p.startDate), deltaBusinessDays)
              )
              const depEnd = toIsoDate(
                addBusinessDays(parseLocalDate(p.endDate), deltaBusinessDays)
              )
              return { ...p, startDate: depStart, endDate: depEnd }
            }
            return p
          })

          // Also shift milestones inside moved project
          const updatedMilestones =
            mode === 'move'
              ? cur.milestones.map((m) =>
                  m.projectId === projectId
                    ? {
                        ...m,
                        targetDate: toIsoDate(
                          addBusinessDays(parseLocalDate(m.targetDate), deltaBusinessDays)
                        )
                      }
                    : m
                )
              : cur.milestones

          void persistDataset({
            ...cur,
            projects: updatedProjects,
            milestones: updatedMilestones
          })
        },

        addPeople: (newPeople) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          const created: Person[] = newPeople.map((pe, idx) => ({
            ...pe,
            id: `person-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            scenarioId: sid
          }))
          void persistDataset({
            ...cur,
            people: [...cur.people, ...created]
          })
        },

        updatePerson: (personId, patch) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            people: cur.people.map((pe) =>
              pe.id === personId ? { ...pe, ...patch } : pe
            )
          })
        },

        deletePerson: (personId) => {
          const cur = get().dataset
          set((s) => ({
            selectedPersonIds: s.selectedPersonIds.filter((id) => id !== personId)
          }))
          void persistDataset({
            ...cur,
            people: cur.people.filter((pe) => pe.id !== personId),
            assignments: cur.assignments.filter((a) => a.personId !== personId),
            timeOff: cur.timeOff.filter((t) => t.personId !== personId)
          })
        },

        upsertAssignment: (
          projectId,
          personId,
          allocationValue,
          allocationMode = 'total_hours',
          requiredRole = '',
          requiredSkills = []
        ) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          const existing = cur.assignments.find(
            (a) => a.projectId === projectId && a.personId === personId
          )

          let nextAssignments: Assignment[]
          if (existing) {
            nextAssignments = cur.assignments.map((a) =>
              a.id === existing.id
                ? {
                    ...a,
                    allocationValue,
                    allocationMode,
                    requiredRole: requiredRole || a.requiredRole,
                    requiredSkills:
                      requiredSkills.length > 0 ? requiredSkills : a.requiredSkills
                  }
                : a
            )
          } else {
            nextAssignments = [
              ...cur.assignments,
              {
                id: `asn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                scenarioId: sid,
                projectId,
                personId,
                requiredRole,
                requiredSkills,
                allocationMode,
                allocationValue,
                meta: {}
              }
            ]
          }

          void persistDataset({ ...cur, assignments: nextAssignments })
        },

        upsertMultipleAssignments: (projectId, entries) => {
          if (entries.length === 0) return
          const cur = get().dataset
          const sid = cur.scenario.id
          let nextAssignments = [...cur.assignments]

          for (const entry of entries) {
            const existingIdx = nextAssignments.findIndex(
              (a) => a.projectId === projectId && a.personId === entry.personId
            )
            if (existingIdx >= 0) {
              const existing = nextAssignments[existingIdx]
              nextAssignments[existingIdx] = {
                ...existing,
                allocationValue: entry.allocationValue,
                allocationMode: entry.allocationMode,
                requiredRole: entry.requiredRole || existing.requiredRole,
                requiredSkills:
                  entry.requiredSkills && entry.requiredSkills.length > 0
                    ? entry.requiredSkills
                    : existing.requiredSkills
              }
            } else {
              nextAssignments.push({
                id: `asn-${Date.now()}-${entry.personId}-${Math.random().toString(36).slice(2, 5)}`,
                scenarioId: sid,
                projectId,
                personId: entry.personId,
                requiredRole: entry.requiredRole || '',
                requiredSkills: entry.requiredSkills || [],
                allocationMode: entry.allocationMode,
                allocationValue: entry.allocationValue,
                meta: {}
              })
            }
          }

          void persistDataset({ ...cur, assignments: nextAssignments })
        },

        removeAssignment: (assignmentId) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            assignments: cur.assignments.filter((a) => a.id !== assignmentId)
          })
        },

        addMilestone: (ms) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          void persistDataset({
            ...cur,
            milestones: [
              ...cur.milestones,
              {
                ...ms,
                id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                scenarioId: sid
              }
            ]
          })
        },

        removeMilestone: (milestoneId) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            milestones: cur.milestones.filter((m) => m.id !== milestoneId)
          })
        },

        addDependency: (fromProjectId, toProjectId) => {
          if (fromProjectId === toProjectId) return
          const cur = get().dataset
          const exists = cur.dependencies.some(
            (d) =>
              d.fromProjectId === fromProjectId && d.toProjectId === toProjectId
          )
          if (exists) return
          void persistDataset({
            ...cur,
            dependencies: [
              ...cur.dependencies,
              {
                id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                scenarioId: cur.scenario.id,
                fromProjectId,
                toProjectId
              }
            ]
          })
        },

        removeDependency: (dependencyId) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            dependencies: cur.dependencies.filter((d) => d.id !== dependencyId)
          })
        },

        setHolidays: (holidays) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          void persistDataset({
            ...cur,
            holidays: holidays.map((h, i) => ({
              ...h,
              id: `hol-${Date.now()}-${i}`,
              scenarioId: sid
            }))
          })
        },

        upsertTimeOff: (pto) => {
          const cur = get().dataset
          const sid = cur.scenario.id
          if (pto.id) {
            void persistDataset({
              ...cur,
              timeOff: cur.timeOff.map((t) =>
                t.id === pto.id ? { ...pto, id: pto.id, scenarioId: sid } : t
              )
            })
          } else {
            void persistDataset({
              ...cur,
              timeOff: [
                ...cur.timeOff,
                {
                  ...pto,
                  id: `pto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  scenarioId: sid
                }
              ]
            })
          }
        },

        removeTimeOff: (timeOffId) => {
          const cur = get().dataset
          void persistDataset({
            ...cur,
            timeOff: cur.timeOff.filter((t) => t.id !== timeOffId)
          })
        }
      }
    },
    {
      partialize: (state) => ({ dataset: state.dataset }),
      equality: (a, b) => a.dataset === b.dataset,
      limit: 40
    }
  )
)

if (typeof window !== 'undefined') {
  ;(window as unknown as { useDeckStore: typeof useDeckStore }).useDeckStore = useDeckStore
}

