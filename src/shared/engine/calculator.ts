import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth
} from 'date-fns'
import type {
  Assignment,
  ChartFilterScope,
  Holiday,
  MonthlyBudget,
  MonthlyRollup,
  Person,
  PersonHeatmapRow,
  PersonMonthUtilization,
  Project,
  ProjectMonthlyBreakdown,
  ScenarioDataset,
  TimeOff
} from '../types'

const weekdaysRangeCache = new Map<string, string[]>()
const holidaySetCache = new WeakMap<Holiday[], Set<string>>()
const rollupDatasetCache = new WeakMap<ScenarioDataset, Map<string, MonthlyRollup[]>>()
const heatmapDatasetCache = new WeakMap<ScenarioDataset, Map<boolean, PersonHeatmapRow[]>>()

/**
 * Parses a YYYY-MM-DD date string safely into a local Date at midnight.
 */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Formats a Date to YYYY-MM-DD without date-fns format token overhead.
 */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${m < 10 ? `0${m}` : m}-${d < 10 ? `0${d}` : d}`
}

/**
 * Returns all weekday (Mon-Fri) date strings (YYYY-MM-DD) within [startDate, endDate] inclusive.
 * Cached by startDate..endDate range for instant O(1) lookup across components.
 */
export function getWeekdaysInRange(startDate: string, endDate: string): string[] {
  if (endDate < startDate) return []
  const cacheKey = `${startDate}|${endDate}`
  const cached = weekdaysRangeCache.get(cacheKey)
  if (cached) return cached

  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (end < start) return []

  const days = eachDayOfInterval({ start, end })
  const result: string[] = []
  for (const day of days) {
    const dow = day.getDay()
    if (dow !== 0 && dow !== 6) {
      result.push(toIsoDate(day))
    }
  }
  if (weekdaysRangeCache.size > 4000) {
    weekdaysRangeCache.clear()
  }
  weekdaysRangeCache.set(cacheKey, result)
  return result
}

/**
 * Builds a Set of YYYY-MM-DD strings that are company holidays (falling on weekdays).
 */
export function buildHolidayWeekdaySet(holidays: Holiday[]): Set<string> {
  const cached = holidaySetCache.get(holidays)
  if (cached) return cached

  const set = new Set<string>()
  for (const h of holidays) {
    for (const day of getWeekdaysInRange(h.startDate, h.endDate)) {
      set.add(day)
    }
  }
  holidaySetCache.set(holidays, set)
  return set
}

/**
 * Returns the active working weekdays in [startDate, endDate] excluding company holidays.
 * If all weekdays in a range happen to be holidays, falls back to standard weekdays so division-by-zero never occurs.
 */
export function getWorkingWeekdaysInRange(
  startDate: string,
  endDate: string,
  holidaySet: Set<string>
): string[] {
  const weekdays = getWeekdaysInRange(startDate, endDate)
  if (holidaySet.size === 0) return weekdays
  const working = weekdays.filter((d) => !holidaySet.has(d))
  return working.length > 0 ? working : weekdays
}

/**
 * Computes the total hours for an assignment across an entire project duration.
 */
export function computeAssignmentTotalHours(
  assignment: Assignment,
  projectWorkingWeekdaysCount: number,
  personHoursPerDay: number
): number {
  switch (assignment.allocationMode) {
    case 'total_hours':
      return Math.max(0, assignment.allocationValue)
    case 'hours_per_day':
      return Math.max(0, assignment.allocationValue * projectWorkingWeekdaysCount)
    case 'percent':
      return Math.max(
        0,
        (assignment.allocationValue / 100) * personHoursPerDay * projectWorkingWeekdaysCount
      )
    default:
      return Math.max(0, assignment.allocationValue)
  }
}

/**
 * Computes the total cost of a project across its entire duration, broken down into Labor, Non-Labor, CapEx, and OpEx.
 */
export function computeProjectTotalFinancials(
  project: Project,
  assignments: Assignment[],
  peopleMap: Map<string, Person>,
  holidaySet: Set<string>
): {
  totalHours: number
  laborCost: number
  nonLaborCost: number
  totalCost: number
  capexCost: number
  opexCost: number
} {
  const projectWorkingDays = getWorkingWeekdaysInRange(
    project.startDate,
    project.endDate,
    holidaySet
  )
  const weekdayCount = projectWorkingDays.length

  let totalHours = 0
  let calculatedLaborCost = 0

  for (const asn of assignments) {
    if (asn.projectId !== project.id) continue
    const person = peopleMap.get(asn.personId)
    const hoursPerDay = person ? person.hoursPerDay : 8
    const hrs = computeAssignmentTotalHours(asn, weekdayCount, hoursPerDay)
    totalHours += hrs

    const rate =
      person && person.hourlyRate > 0 ? person.hourlyRate : project.blendedHourlyRate || 0
    calculatedLaborCost += hrs * rate
  }

  let laborCost = 0
  let nonLaborCost = 0
  let totalCost = 0

  if (project.costMode === 'calculated') {
    laborCost = calculatedLaborCost
    nonLaborCost = Math.max(0, project.fixedCost)
    totalCost = laborCost + nonLaborCost
  } else {
    // 'fixed' mode (lump-sum cost, falling back to calculated labor cost if fixedCost is 0)
    const configuredFixed = Math.max(0, project.fixedCost)
    totalCost = configuredFixed > 0 ? configuredFixed : calculatedLaborCost
    if (calculatedLaborCost > 0 && calculatedLaborCost <= totalCost) {
      laborCost = calculatedLaborCost
      nonLaborCost = totalCost - calculatedLaborCost
    } else {
      laborCost = calculatedLaborCost > 0 ? totalCost : 0
      nonLaborCost = calculatedLaborCost > 0 ? 0 : totalCost
    }
  }

  const capexRatio = Math.min(100, Math.max(0, project.capexPercent ?? 0)) / 100
  const capexCost = totalCost * capexRatio
  const opexCost = totalCost * (1 - capexRatio)

  return {
    totalHours,
    laborCost,
    nonLaborCost,
    totalCost,
    capexCost,
    opexCost
  }
}

/**
 * Calculates a person's available capacity hours in a specific calendar month (YYYY-MM),
 * accounting for:
 * - Weekdays in that month
 * - Company-wide holidays
 * - Person's start_date (hire date) and end_date (contract end)
 * - Personal Time Off (PTO)
 */
export function computePersonMonthlyCapacity(
  person: Person,
  year: number,
  month: number, // 1-12
  holidaySet: Set<string>,
  personTimeOff: TimeOff[]
): {
  availableWeekdays: number
  ptoDays: number
  capacityHours: number
  isActiveInMonth: boolean
} {
  const monthStart = startOfMonth(new Date(year, month - 1, 1))
  const monthEnd = endOfMonth(monthStart)
  const monthStartStr = toIsoDate(monthStart)
  const monthEndStr = toIsoDate(monthEnd)

  // Check if person is employed during this month
  const effectiveStart =
    person.startDate && person.startDate > monthStartStr ? person.startDate : monthStartStr
  const effectiveEnd =
    person.endDate && person.endDate < monthEndStr ? person.endDate : monthEndStr

  if (effectiveEnd < effectiveStart) {
    return { availableWeekdays: 0, ptoDays: 0, capacityHours: 0, isActiveInMonth: false }
  }

  const weekdays = getWeekdaysInRange(effectiveStart, effectiveEnd)
  const workingDays = weekdays.filter((d) => !holidaySet.has(d))

  // Calculate PTO deduction on working days
  let ptoHoursDeducted = 0
  let ptoDaysCount = 0

  for (const pto of personTimeOff) {
    const ptoStart = pto.startDate > effectiveStart ? pto.startDate : effectiveStart
    const ptoEnd = pto.endDate < effectiveEnd ? pto.endDate : effectiveEnd
    if (ptoEnd >= ptoStart) {
      const ptoWorkingDays = getWeekdaysInRange(ptoStart, ptoEnd).filter(
        (d) => !holidaySet.has(d)
      )
      ptoDaysCount += ptoWorkingDays.length
      const dailyOff = pto.hoursPerDayOff > 0 ? pto.hoursPerDayOff : person.hoursPerDay
      ptoHoursDeducted += ptoWorkingDays.length * Math.min(person.hoursPerDay, dailyOff)
    }
  }

  const grossHours = workingDays.length * person.hoursPerDay
  const capacityHours = Math.max(0, grossHours - ptoHoursDeducted)

  return {
    availableWeekdays: Math.max(0, workingDays.length - ptoDaysCount),
    ptoDays: ptoDaysCount,
    capacityHours,
    isActiveInMonth: workingDays.length > 0
  }
}

/**
 * Determines the list of YYYY-MM strings to display across charts and heatmaps based on budgets and projects.
 */
export function getHorizonMonths(dataset: ScenarioDataset): { year: number; month: number; yearMonth: string }[] {
  const years = new Set<number>()
  for (const b of dataset.budgets) {
    if (b.budgetAmount > 0 || b.capexBudget > 0 || b.opexBudget > 0) {
      years.add(b.year)
    }
  }

  let minDateStr: string | null = null
  let maxDateStr: string | null = null

  for (const p of dataset.projects) {
    if (!minDateStr || p.startDate < minDateStr) minDateStr = p.startDate
    if (!maxDateStr || p.endDate > maxDateStr) maxDateStr = p.endDate
  }

  if (minDateStr && maxDateStr) {
    const startYear = Number(minDateStr.slice(0, 4))
    const endYear = Number(maxDateStr.slice(0, 4))
    for (let y = startYear; y <= endYear; y++) {
      years.add(y)
    }
  }

  if (years.size === 0) {
    years.add(new Date().getFullYear())
  }

  const sortedYears = Array.from(years).sort((a, b) => a - b)
  const result: { year: number; month: number; yearMonth: string }[] = []

  for (const year of sortedYears) {
    for (let month = 1; month <= 12; month++) {
      const ym = `${year}-${String(month).padStart(2, '0')}`
      result.push({ year, month, yearMonth: ym })
    }
  }

  return result
}

/**
 * Main Scenario Rollup Calculator:
 * Computes monthly Capacity vs. Demand (hours) and Budget vs. Cost ($) across the scenario horizon,
 * honoring optional Person/Role/Department filter scopes and Confirmed/Tentative toggles.
 */
export function calculateScenarioMonthlyRollup(
  dataset: ScenarioDataset,
  filter: ChartFilterScope = {
    type: 'all',
    value: 'all',
    includeTentative: true,
    financialBreakdown: 'total'
  }
): MonthlyRollup[] {
  const filterKey = `${filter.type}|${filter.value}|${filter.includeTentative ? 1 : 0}`
  let byFilter = rollupDatasetCache.get(dataset)
  if (byFilter) {
    const cachedRollup = byFilter.get(filterKey)
    if (cachedRollup) return cachedRollup
  } else {
    byFilter = new Map()
    rollupDatasetCache.set(dataset, byFilter)
  }

  const holidaySet = buildHolidayWeekdaySet(dataset.holidays)
  const horizon = getHorizonMonths(dataset)
  const peopleMap = new Map<string, Person>(dataset.people.map((p) => [p.id, p]))

  // Filter people matching the scope
  const matchingPeople = dataset.people.filter((person) => {
    if (filter.type === 'person' && filter.value !== 'all') {
      return person.id === filter.value
    }
    if (filter.type === 'role' && filter.value !== 'all') {
      return person.role.toLowerCase() === filter.value.toLowerCase()
    }
    if (filter.type === 'department' && filter.value !== 'all') {
      return person.department.toLowerCase() === filter.value.toLowerCase()
    }
    return true
  })
  const matchingPersonIds = new Set(matchingPeople.map((p) => p.id))

  // Index timeOff by personId
  const timeOffByPerson = new Map<string, TimeOff[]>()
  for (const to of dataset.timeOff) {
    const list = timeOffByPerson.get(to.personId) || []
    list.push(to)
    timeOffByPerson.set(to.personId, list)
  }

  // Index budgets by YYYY-MM
  const budgetMap = new Map<string, MonthlyBudget>()
  for (const b of dataset.budgets) {
    const ym = `${b.year}-${String(b.month).padStart(2, '0')}`
    budgetMap.set(ym, b)
  }

  // Only timeline projects factor into active charts (per 2011 spec)
  const timelineProjects = dataset.projects.filter((p) => p.status === 'timeline')

  // Pre-compute each timeline project's working weekdays & financials
  const projectDataMap = new Map<
    string,
    {
      project: Project
      workingWeekdays: string[]
      financials: ReturnType<typeof computeProjectTotalFinancials>
      scopedHours: number
    }
  >()

  for (const proj of timelineProjects) {
    const workingWeekdays = getWorkingWeekdaysInRange(
      proj.startDate,
      proj.endDate,
      holidaySet
    )
    const financials = computeProjectTotalFinancials(
      proj,
      dataset.assignments,
      peopleMap,
      holidaySet
    )

    // Sum hours only for assignments belonging to matchingPeople
    let scopedHours = 0
    for (const asn of dataset.assignments) {
      if (asn.projectId !== proj.id) continue
      if (!matchingPersonIds.has(asn.personId)) continue
      const person = peopleMap.get(asn.personId)
      const hrsPerDay = person ? person.hoursPerDay : 8
      scopedHours += computeAssignmentTotalHours(asn, workingWeekdays.length, hrsPerDay)
    }

    projectDataMap.set(proj.id, {
      project: proj,
      workingWeekdays,
      financials,
      scopedHours
    })
  }

  const computedRollups = horizon.map(({ year, month, yearMonth }) => {
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(monthStart)
    const monthStartStr = toIsoDate(monthStart)
    const monthEndStr = toIsoDate(monthEnd)

    const allMonthWeekdays = getWeekdaysInRange(monthStartStr, monthEndStr)
    const workingMonthWeekdays = allMonthWeekdays.filter((d) => !holidaySet.has(d))
    const holidayWeekdays = allMonthWeekdays.length - workingMonthWeekdays.length

    // 1. Sum Capacity Hours across matching people
    let capacityHours = 0
    for (const person of matchingPeople) {
      const ptoList = timeOffByPerson.get(person.id) || []
      const cap = computePersonMonthlyCapacity(person, year, month, holidaySet, ptoList)
      capacityHours += cap.capacityHours
    }

    // 2. Sum Demand Hours & Project Costs prorated by working weekdays in this month
    let confirmedDemandHours = 0
    let tentativeDemandHours = 0
    let confirmedCost = 0
    let tentativeCost = 0
    let laborCost = 0
    let nonLaborCost = 0
    let capexCost = 0
    let opexCost = 0
    const projectBreakdowns: ProjectMonthlyBreakdown[] = []

    for (const [, pInfo] of projectDataMap) {
      const { project, workingWeekdays, financials, scopedHours } = pInfo
      if (workingWeekdays.length === 0) continue

      // Count how many of the project's working weekdays fall in this YYYY-MM
      const monthProjDays = workingWeekdays.filter((d) => d.startsWith(yearMonth)).length
      if (monthProjDays === 0) continue

      const fraction = monthProjDays / workingWeekdays.length
      const monthHours = scopedHours * fraction
      const monthTotalCost = financials.totalCost * fraction
      const monthLaborCost = financials.laborCost * fraction
      const monthNonLaborCost = financials.nonLaborCost * fraction
      const monthCapex = financials.capexCost * fraction
      const monthOpex = financials.opexCost * fraction

      const isTentative = project.certainty === 'tentative'

      if (isTentative) {
        tentativeDemandHours += monthHours
        tentativeCost += monthTotalCost
      } else {
        confirmedDemandHours += monthHours
        confirmedCost += monthTotalCost
      }

      if (!isTentative || filter.includeTentative) {
        laborCost += monthLaborCost
        nonLaborCost += monthNonLaborCost
        capexCost += monthCapex
        opexCost += monthOpex

        if (monthHours > 0 || monthTotalCost > 0) {
          projectBreakdowns.push({
            projectId: project.id,
            projectName: project.name,
            certainty: project.certainty,
            hours: Number(monthHours.toFixed(1)),
            laborCost: Number(monthLaborCost.toFixed(2)),
            nonLaborCost: Number(monthNonLaborCost.toFixed(2)),
            totalCost: Number(monthTotalCost.toFixed(2)),
            capexCost: Number(monthCapex.toFixed(2)),
            opexCost: Number(monthOpex.toFixed(2))
          })
        }
      }
    }

    const totalDemandHours = filter.includeTentative
      ? confirmedDemandHours + tentativeDemandHours
      : confirmedDemandHours

    const totalCost = filter.includeTentative
      ? confirmedCost + tentativeCost
      : confirmedCost

    const budgetObj = budgetMap.get(yearMonth)
    const budgetAmount = budgetObj ? budgetObj.budgetAmount : 0
    const capexBudget = budgetObj ? budgetObj.capexBudget : 0
    const opexBudget = budgetObj ? budgetObj.opexBudget : 0

    const isCapacityOverrun = capacityHours > 0 ? totalDemandHours > capacityHours : totalDemandHours > 0
    const capacityOverrunHours = Math.max(0, totalDemandHours - capacityHours)
    const utilizationPercent =
      capacityHours > 0 ? Math.round((totalDemandHours / capacityHours) * 100) : 0

    const isBudgetOverrun = budgetAmount > 0 ? totalCost > budgetAmount : false
    const budgetOverrunAmount = Math.max(0, totalCost - budgetAmount)

    return {
      yearMonth,
      year,
      month,
      label: format(monthStart, 'MMM yyyy'),
      totalWeekdays: allMonthWeekdays.length,
      holidayWeekdays,
      workingWeekdays: workingMonthWeekdays.length,
      capacityHours: Number(capacityHours.toFixed(1)),
      confirmedDemandHours: Number(confirmedDemandHours.toFixed(1)),
      tentativeDemandHours: Number(tentativeDemandHours.toFixed(1)),
      totalDemandHours: Number(totalDemandHours.toFixed(1)),
      isCapacityOverrun,
      capacityOverrunHours: Number(capacityOverrunHours.toFixed(1)),
      utilizationPercent,
      budgetAmount: Number(budgetAmount.toFixed(2)),
      capexBudget: Number(capexBudget.toFixed(2)),
      opexBudget: Number(opexBudget.toFixed(2)),
      confirmedCost: Number(confirmedCost.toFixed(2)),
      tentativeCost: Number(tentativeCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      nonLaborCost: Number(nonLaborCost.toFixed(2)),
      capexCost: Number(capexCost.toFixed(2)),
      opexCost: Number(opexCost.toFixed(2)),
      isBudgetOverrun,
      budgetOverrunAmount: Number(budgetOverrunAmount.toFixed(2)),
      projectBreakdowns
    }
  })

  byFilter.set(filterKey, computedRollups)
  return computedRollups
}

/**
 * Computes the Team & Role Utilization Heatmap Matrix (People x Months).
 */
export function calculateUtilizationHeatmap(
  dataset: ScenarioDataset,
  includeTentative = true
): PersonHeatmapRow[] {
  let byTentative = heatmapDatasetCache.get(dataset)
  if (byTentative) {
    const cachedHeatmap = byTentative.get(includeTentative)
    if (cachedHeatmap) return cachedHeatmap
  } else {
    byTentative = new Map()
    heatmapDatasetCache.set(dataset, byTentative)
  }

  const holidaySet = buildHolidayWeekdaySet(dataset.holidays)
  const horizon = getHorizonMonths(dataset)
  const timelineProjects = dataset.projects.filter((p) => p.status === 'timeline')
  const projectMap = new Map(timelineProjects.map((p) => [p.id, p]))

  // Precompute working weekdays for each timeline project
  const projectWorkingDaysMap = new Map<string, string[]>()
  for (const proj of timelineProjects) {
    projectWorkingDaysMap.set(
      proj.id,
      getWorkingWeekdaysInRange(proj.startDate, proj.endDate, holidaySet)
    )
  }

  const computedRows = dataset.people.map((person) => {
    const personTimeOff = dataset.timeOff.filter((t) => t.personId === person.id)
    const personAssignments = dataset.assignments.filter(
      (a) => a.personId === person.id && projectMap.has(a.projectId)
    )

    const months: Record<string, PersonMonthUtilization> = {}
    let activeMonthsSum = 0
    let activeMonthsCount = 0
    let peakUtilization = 0
    let overallocatedMonthsCount = 0

    for (const { year, month, yearMonth } of horizon) {
      const cap = computePersonMonthlyCapacity(
        person,
        year,
        month,
        holidaySet,
        personTimeOff
      )

      let confirmedHours = 0
      let tentativeHours = 0
      const projectAllocations: PersonMonthUtilization['projectAllocations'] = []

      for (const asn of personAssignments) {
        const proj = projectMap.get(asn.projectId)!
        const workingDays = projectWorkingDaysMap.get(proj.id) || []
        if (workingDays.length === 0) continue

        const monthDays = workingDays.filter((d) => d.startsWith(yearMonth)).length
        if (monthDays === 0) continue

        const totalAsnHours = computeAssignmentTotalHours(
          asn,
          workingDays.length,
          person.hoursPerDay
        )
        const monthAsnHours = totalAsnHours * (monthDays / workingDays.length)

        if (proj.certainty === 'tentative') {
          tentativeHours += monthAsnHours
        } else {
          confirmedHours += monthAsnHours
        }

        if (proj.certainty === 'confirmed' || includeTentative) {
          projectAllocations.push({
            projectId: proj.id,
            projectName: proj.name,
            certainty: proj.certainty,
            hours: Number(monthAsnHours.toFixed(1))
          })
        }
      }

      const totalDemandHours = includeTentative
        ? confirmedHours + tentativeHours
        : confirmedHours

      let utilizationPercent = 0
      let status: PersonMonthUtilization['status'] = 'inactive'

      if (!cap.isActiveInMonth && totalDemandHours === 0) {
        status = 'inactive'
      } else if (cap.capacityHours <= 0 && totalDemandHours > 0) {
        utilizationPercent = 150
        status = 'overallocated'
      } else {
        utilizationPercent = Math.round((totalDemandHours / cap.capacityHours) * 100)
        if (utilizationPercent > 100) {
          status = 'overallocated'
        } else if (utilizationPercent >= 70) {
          status = 'optimal'
        } else {
          status = 'bench'
        }
      }

      if (status !== 'inactive') {
        activeMonthsSum += utilizationPercent
        activeMonthsCount++
        if (utilizationPercent > peakUtilization) peakUtilization = utilizationPercent
        if (status === 'overallocated') overallocatedMonthsCount++
      }

      months[yearMonth] = {
        personId: person.id,
        yearMonth,
        availableWeekdays: cap.availableWeekdays,
        ptoDays: cap.ptoDays,
        capacityHours: Number(cap.capacityHours.toFixed(1)),
        confirmedHours: Number(confirmedHours.toFixed(1)),
        tentativeHours: Number(tentativeHours.toFixed(1)),
        totalDemandHours: Number(totalDemandHours.toFixed(1)),
        utilizationPercent,
        status,
        projectAllocations
      }
    }

    return {
      person,
      months,
      averageUtilization:
        activeMonthsCount > 0 ? Math.round(activeMonthsSum / activeMonthsCount) : 0,
      peakUtilization,
      overallocatedMonthsCount
    }
  })

  byTentative.set(includeTentative, computedRows)
  return computedRows
}
