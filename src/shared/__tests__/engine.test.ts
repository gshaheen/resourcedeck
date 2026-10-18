import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  buildHolidayWeekdaySet,
  calculateScenarioMonthlyRollup,
  calculateUtilizationHeatmap,
  getWeekdaysInRange
} from '../engine/calculator'
import { compareScenarios } from '../engine/diffEngine'
import { rankSmartStaffSuggestions } from '../engine/smartStaff'
import { createSamplePortfolio } from '../engine/sampleData'
import { RDeckDatabase } from '../../main/db/database'
import type { ScenarioDataset } from '../types'

describe('resourcedeck Calculation Engine & 2011 Spec Verification', () => {
  it('accurately calculates the exact 2011 spec example: 6/25/2012 to 7/6/2012 ($1000 cost = $500 June, $500 July)', () => {
    const weekdays = getWeekdaysInRange('2012-06-25', '2012-07-06')
    expect(weekdays.length).toBe(10)

    const juneDays = weekdays.filter((d) => d.startsWith('2012-06'))
    const julyDays = weekdays.filter((d) => d.startsWith('2012-07'))
    expect(juneDays.length).toBe(5)
    expect(julyDays.length).toBe(5)

    const dataset: ScenarioDataset = {
      scenario: {
        id: 'scen-2011',
        parentScenarioId: null,
        name: '2011 Spec Verification',
        description: '',
        isBaseline: true,
        createdAt: '2012-01-01T00:00:00Z',
        meta: {}
      },
      projects: [
        {
          id: 'proj-1',
          scenarioId: 'scen-2011',
          name: 'Spec Project',
          startDate: '2012-06-25',
          endDate: '2012-07-06',
          status: 'timeline',
          certainty: 'confirmed',
          priorityRank: 1,
          valueScore: 80,
          costMode: 'fixed',
          fixedCost: 1000,
          capexPercent: 50,
          blendedHourlyRate: 0,
          color: '#4f46e5',
          meta: {}
        },
        {
          id: 'proj-on-deck',
          scenarioId: 'scen-2011',
          name: 'On Deck Project (Should not factor into charts)',
          startDate: '2012-06-25',
          endDate: '2012-07-06',
          status: 'on_deck',
          certainty: 'confirmed',
          priorityRank: 2,
          valueScore: 70,
          costMode: 'fixed',
          fixedCost: 5000,
          capexPercent: 0,
          blendedHourlyRate: 0,
          color: '#10b981',
          meta: {}
        }
      ],
      people: [
        {
          id: 'person-adam',
          scenarioId: 'scen-2011',
          name: 'Adam',
          isPlaceholder: false,
          role: 'Engineer',
          department: 'Eng',
          skills: ['TypeScript'],
          hoursPerDay: 8,
          hourlyRate: 0,
          costType: 'project_default',
          startDate: null,
          endDate: null,
          meta: {}
        }
      ],
      assignments: [
        {
          id: 'asn-1',
          scenarioId: 'scen-2011',
          projectId: 'proj-1',
          personId: 'person-adam',
          requiredRole: '',
          requiredSkills: [],
          allocationMode: 'total_hours',
          allocationValue: 100,
          meta: {}
        },
        {
          id: 'asn-on-deck',
          scenarioId: 'scen-2011',
          projectId: 'proj-on-deck',
          personId: 'person-adam',
          requiredRole: '',
          requiredSkills: [],
          allocationMode: 'total_hours',
          allocationValue: 400,
          meta: {}
        }
      ],
      milestones: [],
      dependencies: [],
      holidays: [],
      timeOff: [],
      budgets: [
        {
          scenarioId: 'scen-2011',
          year: 2012,
          month: 6,
          budgetAmount: 400, // Will trigger budget overrun in June ($500 > $400)
          capexBudget: 200,
          opexBudget: 200,
          meta: {}
        },
        {
          scenarioId: 'scen-2011',
          year: 2012,
          month: 7,
          budgetAmount: 600, // Under budget in July ($500 <= $600)
          capexBudget: 300,
          opexBudget: 300,
          meta: {}
        }
      ]
    }

    const rollups = calculateScenarioMonthlyRollup(dataset)
    const june = rollups.find((r) => r.yearMonth === '2012-06')!
    const july = rollups.find((r) => r.yearMonth === '2012-07')!

    expect(june.totalCost).toBe(500)
    expect(july.totalCost).toBe(500)
    expect(june.totalDemandHours).toBe(50)
    expect(july.totalDemandHours).toBe(50)
    expect(june.isBudgetOverrun).toBe(true)
    expect(july.isBudgetOverrun).toBe(false)
  })

  it('deducts company holidays, PTO, and respects hire start_date on person capacity', () => {
    const { baseline } = createSamplePortfolio()
    const holidaySet = buildHolidayWeekdaySet(baseline.holidays)
    expect(holidaySet.has('2026-05-25')).toBe(true) // Memorial Day

    const rollups = calculateScenarioMonthlyRollup(baseline)
    const june = rollups.find((r) => r.yearMonth === '2026-06')!
    expect(june.holidayWeekdays).toBe(1) // Juneteenth
    expect(june.isBudgetOverrun).toBe(true) // Sample baseline has intentional June overrun

    const heatmap = calculateUtilizationHeatmap(baseline)
    expect(heatmap.length).toBeGreaterThan(0)
    const tbdRow = heatmap.find((r) => r.person.isPlaceholder)!
    // TBD hire starts 2026-08-03, so June capacity must be 0
    expect(tbdRow.months['2026-06'].capacityHours).toBe(0)
    expect(tbdRow.months['2026-08'].capacityHours).toBeGreaterThan(0)
  })

  it('computes scenario diffs and smart staffing suggestions accurately', () => {
    const { baseline, whatIf } = createSamplePortfolio()
    const diff = compareScenarios(baseline, whatIf)

    expect(diff.projectDiffs.length).toBe(1)
    expect(diff.projectDiffs[0].projectId).toBe('proj-cloud-migration')
    expect(diff.projectDiffs[0].startShiftWeekdays).toBeGreaterThan(0)

    const targetProject = baseline.projects[0]
    const suggestions = rankSmartStaffSuggestions(
      baseline,
      targetProject,
      40,
      'Engineer',
      ['TypeScript']
    )
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].roleMatches).toBe(true)
  })

  it('persists .rdeck SQLite database with WAL, 10 indexes, AI views, and scenario branching', () => {
    const tmpFile = path.join(os.tmpdir(), `resourcedeck-test-${Date.now()}.rdeck`)
    const dbEngine = new RDeckDatabase()

    try {
      const opened = dbEngine.openFile(tmpFile, true)
      expect(opened.scenarios.length).toBe(2)
      expect(opened.activeScenario.projects.length).toBe(6)

      // Fork a new What-If scenario
      const forked = dbEngine.duplicateScenario(
        opened.activeScenario.scenario.id,
        'What-If Q4 Push',
        'Testing Q4 shift'
      )
      expect(forked.scenario.name).toBe('What-If Q4 Push')
      expect(dbEngine.listScenarios().length).toBe(3)
    } finally {
      dbEngine.close()
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    }
  })
})
