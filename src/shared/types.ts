/**
 * Canonical Data Types for resourcedeck (.rdeck)
 * Shared across Main (SQLite), Preload, Renderer (React), and Calculation Engines.
 */

export type ProjectStatus = 'on_deck' | 'timeline'
export type ProjectCertainty = 'confirmed' | 'tentative'
export type ProjectCostMode = 'fixed' | 'calculated'
export type PersonCostType = 'capex' | 'opex' | 'project_default'
export type AllocationMode = 'total_hours' | 'hours_per_day' | 'percent'

export type ThemeId =
  | 'system'
  | 'executive-slate'
  | 'boardroom-daylight'
  | 'warm-paper'
  | 'nordic-frost'
  | 'midnight-velvet'
  | 'high-contrast'

export interface Scenario {
  id: string
  parentScenarioId: string | null
  name: string
  description: string
  isBaseline: boolean
  createdAt: string
  meta: Record<string, unknown>
}

export interface Project {
  id: string
  scenarioId: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  status: ProjectStatus
  certainty: ProjectCertainty
  priorityRank: number
  valueScore: number // 1-100 strategic value / ROI score
  costMode: ProjectCostMode
  fixedCost: number // Lump sum in 'fixed' mode, or non-labor cost in 'calculated' mode
  capexPercent: number // 0-100
  blendedHourlyRate: number // Optional fallback rate ($/hr)
  color: string
  meta: Record<string, unknown>
}

export interface Person {
  id: string
  scenarioId: string
  name: string
  isPlaceholder: boolean // True for TBD / To-Be-Hired role slots
  role: string
  department: string
  skills: string[]
  hoursPerDay: number // Default 8
  hourlyRate: number // Optional cost rate ($/hr)
  costType: PersonCostType
  startDate: string | null // YYYY-MM-DD (Hire date)
  endDate: string | null // YYYY-MM-DD (Contract end / departure date)
  meta: Record<string, unknown>
}

export interface Assignment {
  id: string
  scenarioId: string
  projectId: string
  personId: string
  requiredRole: string
  requiredSkills: string[]
  allocationMode: AllocationMode
  allocationValue: number // Total hours, hours/day, or percent (0-100)
  meta: Record<string, unknown>
}

export interface Milestone {
  id: string
  scenarioId: string
  projectId: string
  name: string
  targetDate: string // YYYY-MM-DD
  color: string
}

export interface Dependency {
  id: string
  scenarioId: string
  fromProjectId: string
  toProjectId: string
}

export interface Holiday {
  id: string
  scenarioId: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

export interface TimeOff {
  id: string
  scenarioId: string
  personId: string
  reason: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  hoursPerDayOff: number
}

export interface MonthlyBudget {
  scenarioId: string
  year: number
  month: number // 1-12
  budgetAmount: number
  capexBudget: number
  opexBudget: number
  meta: Record<string, unknown>
}

export interface ScenarioDataset {
  scenario: Scenario
  projects: Project[]
  people: Person[]
  assignments: Assignment[]
  milestones: Milestone[]
  dependencies: Dependency[]
  holidays: Holiday[]
  timeOff: TimeOff[]
  budgets: MonthlyBudget[]
}

export interface ProjectMonthlyBreakdown {
  projectId: string
  projectName: string
  certainty: ProjectCertainty
  hours: number
  laborCost: number
  nonLaborCost: number
  totalCost: number
  capexCost: number
  opexCost: number
}

export interface MonthlyRollup {
  yearMonth: string // YYYY-MM
  year: number
  month: number // 1-12
  label: string // e.g. 'Apr 2026'
  totalWeekdays: number
  holidayWeekdays: number
  workingWeekdays: number
  // Capacity vs Demand (Hours)
  capacityHours: number
  confirmedDemandHours: number
  tentativeDemandHours: number
  totalDemandHours: number
  isCapacityOverrun: boolean
  capacityOverrunHours: number
  utilizationPercent: number
  // Budgets vs Costs ($)
  budgetAmount: number
  capexBudget: number
  opexBudget: number
  confirmedCost: number
  tentativeCost: number
  totalCost: number
  laborCost: number
  nonLaborCost: number
  capexCost: number
  opexCost: number
  isBudgetOverrun: boolean
  budgetOverrunAmount: number
  // Drill-down details
  projectBreakdowns: ProjectMonthlyBreakdown[]
}

export interface PersonMonthUtilization {
  personId: string
  yearMonth: string
  availableWeekdays: number
  ptoDays: number
  capacityHours: number
  confirmedHours: number
  tentativeHours: number
  totalDemandHours: number
  utilizationPercent: number
  status: 'bench' | 'optimal' | 'overallocated' | 'inactive'
  projectAllocations: {
    projectId: string
    projectName: string
    certainty: ProjectCertainty
    hours: number
  }[]
}

export interface PersonHeatmapRow {
  person: Person
  months: Record<string, PersonMonthUtilization>
  averageUtilization: number
  peakUtilization: number
  overallocatedMonthsCount: number
}

export interface SmartStaffSuggestion {
  person: Person
  matchScore: number // 0-100
  roleMatches: boolean
  matchingSkills: string[]
  missingSkills: string[]
  availableHoursInWindow: number
  capacityHoursInWindow: number
  currentUtilizationInWindow: number // % before this project
  projectedUtilizationInWindow: number // % if assigned
  canAbsorbWithoutOverrun: boolean
}

export interface ScenarioProjectDiff {
  projectId: string
  projectName: string
  changeType: 'added' | 'removed' | 'moved_to_timeline' | 'moved_to_deck' | 'modified'
  baselineStartDate?: string
  baselineEndDate?: string
  currentStartDate?: string
  currentEndDate?: string
  startShiftWeekdays: number
  durationDeltaWeekdays: number
  baselineTotalCost: number
  currentTotalCost: number
  costDelta: number
  baselineTotalHours: number
  currentTotalHours: number
  hoursDelta: number
  baselineStatus?: ProjectStatus
  currentStatus?: ProjectStatus
}

export interface ScenarioStaffingDiff {
  assignmentId: string
  projectId: string
  projectName: string
  personId: string
  personName: string
  changeType: 'assigned' | 'unassigned' | 'modified'
  baselineHours: number
  currentHours: number
  hoursDelta: number
}

export interface ScenarioMonthlyDiff {
  yearMonth: string
  label: string
  baselineDemandHours: number
  currentDemandHours: number
  demandHoursDelta: number
  baselineCapacityHours: number
  currentCapacityHours: number
  capacityHoursDelta: number
  baselineCost: number
  currentCost: number
  costDelta: number
  baselineOverrun: boolean
  currentOverrun: boolean
  overrunResolved: boolean
  overrunCreated: boolean
}

export interface ScenarioComparisonReport {
  baselineScenario: Scenario
  currentScenario: Scenario
  projectDiffs: ScenarioProjectDiff[]
  staffingDiffs: ScenarioStaffingDiff[]
  monthlyDiffs: ScenarioMonthlyDiff[]
  summary: {
    totalBudgetDelta: number
    totalSpendDelta: number
    totalHoursDelta: number
    headcountDelta: number
    baselineOverrunMonths: number
    currentOverrunMonths: number
    netOverrunMonthsDelta: number
  }
}

export interface ChartFilterScope {
  type: 'all' | 'person' | 'role' | 'department'
  value: string // 'all' or personId or role name or department name
  includeTentative: boolean
  financialBreakdown: 'total' | 'by_project' | 'labor_vs_nonlabor'
}
