import type { Project, ScenarioDataset, SmartStaffSuggestion } from '../types'
import {
  buildHolidayWeekdaySet,
  computeAssignmentTotalHours,
  getWeekdaysInRange,
  getWorkingWeekdaysInRange
} from './calculator'

/**
 * Smart Staffing & Skill/Availability Matcher (Mosaic / Float style):
 * Ranks all people in the scenario for a target project window based on:
 * 1. Available capacity hours between project.startDate and project.endDate
 * 2. Role match (if requestedRole is specified)
 * 3. Skill tag overlap (if requestedSkills are specified)
 */
export function rankSmartStaffSuggestions(
  dataset: ScenarioDataset,
  targetProject: Project,
  requestedHours = 40,
  requestedRole = '',
  requestedSkills: string[] = []
): SmartStaffSuggestion[] {
  const holidaySet = buildHolidayWeekdaySet(dataset.holidays)
  const targetWorkingDays = getWorkingWeekdaysInRange(
    targetProject.startDate,
    targetProject.endDate,
    holidaySet
  )
  const targetDaySet = new Set(targetWorkingDays)

  const timelineProjects = dataset.projects.filter((p) => p.status === 'timeline')
  const projectMap = new Map(timelineProjects.map((p) => [p.id, p]))
  const projectWorkingDaysMap = new Map<string, string[]>()
  for (const proj of timelineProjects) {
    projectWorkingDaysMap.set(
      proj.id,
      getWorkingWeekdaysInRange(proj.startDate, proj.endDate, holidaySet)
    )
  }

  const normalizedReqRole = requestedRole.trim().toLowerCase()
  const normalizedReqSkills = requestedSkills.map((s) => s.trim().toLowerCase()).filter(Boolean)

  return dataset.people
    .filter((p) => !p.isPlaceholder)
    .map((person) => {
      // 1. Calculate person's gross working capacity inside [targetProject.startDate, targetProject.endDate]
      const effectiveStart =
        person.startDate && person.startDate > targetProject.startDate
          ? person.startDate
          : targetProject.startDate
      const effectiveEnd =
        person.endDate && person.endDate < targetProject.endDate
          ? person.endDate
          : targetProject.endDate

      let employedWorkingDays: string[] = []
      if (effectiveEnd >= effectiveStart) {
        employedWorkingDays = getWeekdaysInRange(effectiveStart, effectiveEnd).filter(
          (d) => !holidaySet.has(d)
        )
      }

      // Deduct personal PTO falling in window
      const personTimeOff = dataset.timeOff.filter((t) => t.personId === person.id)
      let ptoHours = 0
      for (const pto of personTimeOff) {
        const s = pto.startDate > effectiveStart ? pto.startDate : effectiveStart
        const e = pto.endDate < effectiveEnd ? pto.endDate : effectiveEnd
        if (e >= s) {
          const days = getWeekdaysInRange(s, e).filter((d) => !holidaySet.has(d))
          ptoHours += days.length * Math.min(person.hoursPerDay, pto.hoursPerDayOff || person.hoursPerDay)
        }
      }

      const capacityHoursInWindow = Math.max(
        0,
        employedWorkingDays.length * person.hoursPerDay - ptoHours
      )

      // 2. Calculate already-committed hours in this exact date window across timeline projects
      let committedHoursInWindow = 0
      const personAssignments = dataset.assignments.filter(
        (a) => a.personId === person.id && projectMap.has(a.projectId)
      )

      for (const asn of personAssignments) {
        const projDays = projectWorkingDaysMap.get(asn.projectId) || []
        if (projDays.length === 0) continue

        const overlapDaysCount = projDays.filter((d) => targetDaySet.has(d)).length
        if (overlapDaysCount === 0) continue

        const totalAsnHours = computeAssignmentTotalHours(
          asn,
          projDays.length,
          person.hoursPerDay
        )
        committedHoursInWindow += totalAsnHours * (overlapDaysCount / projDays.length)
      }

      const availableHoursInWindow = Math.max(0, capacityHoursInWindow - committedHoursInWindow)
      const currentUtilizationInWindow =
        capacityHoursInWindow > 0
          ? Math.round((committedHoursInWindow / capacityHoursInWindow) * 100)
          : 100
      const projectedUtilizationInWindow =
        capacityHoursInWindow > 0
          ? Math.round(((committedHoursInWindow + requestedHours) / capacityHoursInWindow) * 100)
          : 150

      const canAbsorbWithoutOverrun =
        capacityHoursInWindow > 0 && committedHoursInWindow + requestedHours <= capacityHoursInWindow

      // 3. Role & Skill Match
      const roleMatches =
        !normalizedReqRole || person.role.toLowerCase().includes(normalizedReqRole)

      const personSkillLowerMap = new Map(
        person.skills.map((s) => [s.toLowerCase(), s])
      )
      const matchingSkills: string[] = []
      const missingSkills: string[] = []

      for (const reqSkill of normalizedReqSkills) {
        const found = personSkillLowerMap.get(reqSkill)
        if (found) {
          matchingSkills.push(found)
        } else {
          missingSkills.push(reqSkill)
        }
      }

      // Compute composite 0-100 match score
      const availabilityRatio =
        capacityHoursInWindow > 0
          ? Math.min(1, Math.max(0, availableHoursInWindow / Math.max(1, requestedHours)))
          : 0
      const availabilityScore = availabilityRatio * 55
      const roleScore = roleMatches ? 25 : 5
      const skillScore =
        normalizedReqSkills.length > 0
          ? (matchingSkills.length / normalizedReqSkills.length) * 20
          : 20

      const matchScore = Math.round(availabilityScore + roleScore + skillScore)

      return {
        person,
        matchScore,
        roleMatches,
        matchingSkills,
        missingSkills,
        availableHoursInWindow: Number(availableHoursInWindow.toFixed(1)),
        capacityHoursInWindow: Number(capacityHoursInWindow.toFixed(1)),
        currentUtilizationInWindow,
        projectedUtilizationInWindow,
        canAbsorbWithoutOverrun
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore || b.availableHoursInWindow - a.availableHoursInWindow)
}
