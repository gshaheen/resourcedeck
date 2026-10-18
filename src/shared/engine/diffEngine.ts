import { differenceInBusinessDays } from 'date-fns'
import type {
  ScenarioComparisonReport,
  ScenarioDataset,
  ScenarioMonthlyDiff,
  ScenarioProjectDiff,
  ScenarioStaffingDiff
} from '../types'
import {
  buildHolidayWeekdaySet,
  calculateScenarioMonthlyRollup,
  computeAssignmentTotalHours,
  computeProjectTotalFinancials,
  getWorkingWeekdaysInRange,
  parseLocalDate
} from './calculator'

/**
 * Compares a Baseline ScenarioDataset against a Current ("What-If") ScenarioDataset,
 * generating project schedule/cost diffs, staffing diffs, monthly capacity/cost deltas,
 * and executive summary metrics.
 */
export function compareScenarios(
  baseline: ScenarioDataset,
  current: ScenarioDataset
): ScenarioComparisonReport {
  const baseHolidays = buildHolidayWeekdaySet(baseline.holidays)
  const currHolidays = buildHolidayWeekdaySet(current.holidays)

  const basePeopleMap = new Map(baseline.people.map((p) => [p.id, p]))
  const currPeopleMap = new Map(current.people.map((p) => [p.id, p]))

  const baseProjectsMap = new Map(baseline.projects.map((p) => [p.id, p]))
  const currProjectsMap = new Map(current.projects.map((p) => [p.id, p]))

  const allProjectIds = new Set([...baseProjectsMap.keys(), ...currProjectsMap.keys()])
  const projectDiffs: ScenarioProjectDiff[] = []

  for (const projectId of allProjectIds) {
    const bp = baseProjectsMap.get(projectId)
    const cp = currProjectsMap.get(projectId)

    const baseFin = bp
      ? computeProjectTotalFinancials(bp, baseline.assignments, basePeopleMap, baseHolidays)
      : { totalHours: 0, totalCost: 0, laborCost: 0, nonLaborCost: 0, capexCost: 0, opexCost: 0 }
    const currFin = cp
      ? computeProjectTotalFinancials(cp, current.assignments, currPeopleMap, currHolidays)
      : { totalHours: 0, totalCost: 0, laborCost: 0, nonLaborCost: 0, capexCost: 0, opexCost: 0 }

    if (!bp && cp) {
      projectDiffs.push({
        projectId,
        projectName: cp.name,
        changeType: 'added',
        currentStartDate: cp.startDate,
        currentEndDate: cp.endDate,
        startShiftWeekdays: 0,
        durationDeltaWeekdays: getWorkingWeekdaysInRange(
          cp.startDate,
          cp.endDate,
          currHolidays
        ).length,
        baselineTotalCost: 0,
        currentTotalCost: currFin.totalCost,
        costDelta: currFin.totalCost,
        baselineTotalHours: 0,
        currentTotalHours: currFin.totalHours,
        hoursDelta: currFin.totalHours,
        currentStatus: cp.status
      })
      continue
    }

    if (bp && !cp) {
      projectDiffs.push({
        projectId,
        projectName: bp.name,
        changeType: 'removed',
        baselineStartDate: bp.startDate,
        baselineEndDate: bp.endDate,
        startShiftWeekdays: 0,
        durationDeltaWeekdays: -getWorkingWeekdaysInRange(
          bp.startDate,
          bp.endDate,
          baseHolidays
        ).length,
        baselineTotalCost: baseFin.totalCost,
        currentTotalCost: 0,
        costDelta: -baseFin.totalCost,
        baselineTotalHours: baseFin.totalHours,
        currentTotalHours: 0,
        hoursDelta: -baseFin.totalHours,
        baselineStatus: bp.status
      })
      continue
    }

    if (bp && cp) {
      const statusChanged = bp.status !== cp.status
      const datesChanged = bp.startDate !== cp.startDate || bp.endDate !== cp.endDate
      const costChanged = Math.abs(baseFin.totalCost - currFin.totalCost) >= 0.01
      const hoursChanged = Math.abs(baseFin.totalHours - currFin.totalHours) >= 0.1

      if (!statusChanged && !datesChanged && !costChanged && !hoursChanged) {
        continue
      }

      const startShiftWeekdays = differenceInBusinessDays(
        parseLocalDate(cp.startDate),
        parseLocalDate(bp.startDate)
      )
      const baseDur = getWorkingWeekdaysInRange(
        bp.startDate,
        bp.endDate,
        baseHolidays
      ).length
      const currDur = getWorkingWeekdaysInRange(
        cp.startDate,
        cp.endDate,
        currHolidays
      ).length

      let changeType: ScenarioProjectDiff['changeType'] = 'modified'
      if (bp.status === 'on_deck' && cp.status === 'timeline') {
        changeType = 'moved_to_timeline'
      } else if (bp.status === 'timeline' && cp.status === 'on_deck') {
        changeType = 'moved_to_deck'
      }

      projectDiffs.push({
        projectId,
        projectName: cp.name,
        changeType,
        baselineStartDate: bp.startDate,
        baselineEndDate: bp.endDate,
        currentStartDate: cp.startDate,
        currentEndDate: cp.endDate,
        startShiftWeekdays,
        durationDeltaWeekdays: currDur - baseDur,
        baselineTotalCost: Number(baseFin.totalCost.toFixed(2)),
        currentTotalCost: Number(currFin.totalCost.toFixed(2)),
        costDelta: Number((currFin.totalCost - baseFin.totalCost).toFixed(2)),
        baselineTotalHours: Number(baseFin.totalHours.toFixed(1)),
        currentTotalHours: Number(currFin.totalHours.toFixed(1)),
        hoursDelta: Number((currFin.totalHours - baseFin.totalHours).toFixed(1)),
        baselineStatus: bp.status,
        currentStatus: cp.status
      })
    }
  }

  // 2. Staffing Diffs
  const baseAsnByKey = new Map(
    baseline.assignments.map((a) => [`${a.projectId}::${a.personId}`, a])
  )
  const currAsnByKey = new Map(
    current.assignments.map((a) => [`${a.projectId}::${a.personId}`, a])
  )
  const allAsnKeys = new Set([...baseAsnByKey.keys(), ...currAsnByKey.keys()])
  const staffingDiffs: ScenarioStaffingDiff[] = []

  for (const key of allAsnKeys) {
    const ba = baseAsnByKey.get(key)
    const ca = currAsnByKey.get(key)
    const [projectId, personId] = key.split('::')

    const projName =
      currProjectsMap.get(projectId)?.name ||
      baseProjectsMap.get(projectId)?.name ||
      'Project'
    const personName =
      currPeopleMap.get(personId)?.name || basePeopleMap.get(personId)?.name || 'Resource'

    const bp = baseProjectsMap.get(projectId)
    const cp = currProjectsMap.get(projectId)

    const baseDays = bp
      ? getWorkingWeekdaysInRange(bp.startDate, bp.endDate, baseHolidays).length
      : 0
    const currDays = cp
      ? getWorkingWeekdaysInRange(cp.startDate, cp.endDate, currHolidays).length
      : 0

    const baseHours = ba
      ? computeAssignmentTotalHours(
          ba,
          baseDays,
          basePeopleMap.get(personId)?.hoursPerDay ?? 8
        )
      : 0
    const currHours = ca
      ? computeAssignmentTotalHours(
          ca,
          currDays,
          currPeopleMap.get(personId)?.hoursPerDay ?? 8
        )
      : 0

    if (!ba && ca) {
      staffingDiffs.push({
        assignmentId: ca.id,
        projectId,
        projectName: projName,
        personId,
        personName,
        changeType: 'assigned',
        baselineHours: 0,
        currentHours: Number(currHours.toFixed(1)),
        hoursDelta: Number(currHours.toFixed(1))
      })
    } else if (ba && !ca) {
      staffingDiffs.push({
        assignmentId: ba.id,
        projectId,
        projectName: projName,
        personId,
        personName,
        changeType: 'unassigned',
        baselineHours: Number(baseHours.toFixed(1)),
        currentHours: 0,
        hoursDelta: Number((-baseHours).toFixed(1))
      })
    } else if (ba && ca && Math.abs(currHours - baseHours) >= 0.5) {
      staffingDiffs.push({
        assignmentId: ca.id,
        projectId,
        projectName: projName,
        personId,
        personName,
        changeType: 'modified',
        baselineHours: Number(baseHours.toFixed(1)),
        currentHours: Number(currHours.toFixed(1)),
        hoursDelta: Number((currHours - baseHours).toFixed(1))
      })
    }
  }

  // 3. Monthly Rollup Diffs
  const baseRollups = calculateScenarioMonthlyRollup(baseline)
  const currRollups = calculateScenarioMonthlyRollup(current)

  const baseRollupMap = new Map(baseRollups.map((r) => [r.yearMonth, r]))
  const currRollupMap = new Map(currRollups.map((r) => [r.yearMonth, r]))
  const allMonths = Array.from(
    new Set([...baseRollupMap.keys(), ...currRollupMap.keys()])
  ).sort()

  const monthlyDiffs: ScenarioMonthlyDiff[] = []
  let totalBudgetDelta = 0
  let totalSpendDelta = 0
  let totalHoursDelta = 0
  let baselineOverrunMonths = 0
  let currentOverrunMonths = 0

  for (const ym of allMonths) {
    const br = baseRollupMap.get(ym)
    const cr = currRollupMap.get(ym)

    const baseDemand = br ? br.totalDemandHours : 0
    const currDemand = cr ? cr.totalDemandHours : 0
    const baseCap = br ? br.capacityHours : 0
    const currCap = cr ? cr.capacityHours : 0
    const baseCost = br ? br.totalCost : 0
    const currCost = cr ? cr.totalCost : 0
    const baseBudget = br ? br.budgetAmount : 0
    const currBudget = cr ? cr.budgetAmount : 0

    const baseOver = br ? br.isCapacityOverrun || br.isBudgetOverrun : false
    const currOver = cr ? cr.isCapacityOverrun || cr.isBudgetOverrun : false

    if (baseOver) baselineOverrunMonths++
    if (currOver) currentOverrunMonths++

    totalBudgetDelta += currBudget - baseBudget
    totalSpendDelta += currCost - baseCost
    totalHoursDelta += currDemand - baseDemand

    monthlyDiffs.push({
      yearMonth: ym,
      label: cr?.label || br?.label || ym,
      baselineDemandHours: baseDemand,
      currentDemandHours: currDemand,
      demandHoursDelta: Number((currDemand - baseDemand).toFixed(1)),
      baselineCapacityHours: baseCap,
      currentCapacityHours: currCap,
      capacityHoursDelta: Number((currCap - baseCap).toFixed(1)),
      baselineCost: baseCost,
      currentCost: currCost,
      costDelta: Number((currCost - baseCost).toFixed(2)),
      baselineOverrun: baseOver,
      currentOverrun: currOver,
      overrunResolved: baseOver && !currOver,
      overrunCreated: !baseOver && currOver
    })
  }

  return {
    baselineScenario: baseline.scenario,
    currentScenario: current.scenario,
    projectDiffs,
    staffingDiffs,
    monthlyDiffs,
    summary: {
      totalBudgetDelta: Number(totalBudgetDelta.toFixed(2)),
      totalSpendDelta: Number(totalSpendDelta.toFixed(2)),
      totalHoursDelta: Number(totalHoursDelta.toFixed(1)),
      headcountDelta: current.people.length - baseline.people.length,
      baselineOverrunMonths,
      currentOverrunMonths,
      netOverrunMonthsDelta: currentOverrunMonths - baselineOverrunMonths
    }
  }
}
