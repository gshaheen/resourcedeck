import type { ScenarioDataset } from '../types'

/**
 * Generates a realistic, executive-ready sample portfolio ("Q2–Q4 2026 Product & Platform Plan")
 * with a Baseline Scenario AND a pre-built "What-If: Defer Cloud Migration & Hire 1 Sr Eng" scenario
 * so first-time users can immediately experience the Gantt timeline, Overrun Red bars, Heatmap, and Scenario Diffs.
 */
export function createSamplePortfolio(): {
  baseline: ScenarioDataset
  whatIf: ScenarioDataset
} {
  const baselineId = 'scen-baseline'
  const whatIfId = 'scen-whatif-1'
  const now = new Date().toISOString()

  const people: ScenarioDataset['people'] = [
    {
      id: 'person-adam',
      scenarioId: baselineId,
      name: 'Adam Vance',
      isPlaceholder: false,
      role: 'Staff Engineer',
      department: 'Engineering',
      skills: ['Architecture', 'TypeScript', 'Cloud', 'SQL'],
      hoursPerDay: 8,
      hourlyRate: 125,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: {}
    },
    {
      id: 'person-bob',
      scenarioId: baselineId,
      name: 'Bob Sterling',
      isPlaceholder: false,
      role: 'Senior Engineer',
      department: 'Engineering',
      skills: ['React', 'TypeScript', 'Node.js'],
      hoursPerDay: 8,
      hourlyRate: 110,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: {}
    },
    {
      id: 'person-chris',
      scenarioId: baselineId,
      name: 'Chris Lin',
      isPlaceholder: false,
      role: 'Product Designer',
      department: 'Design',
      skills: ['Design Systems', 'UX Research', 'Prototyping'],
      hoursPerDay: 8,
      hourlyRate: 100,
      costType: 'opex',
      startDate: null,
      endDate: null,
      meta: {}
    },
    {
      id: 'person-xavier',
      scenarioId: baselineId,
      name: 'Xavier Morales',
      isPlaceholder: false,
      role: 'Data & AI Engineer',
      department: 'Engineering',
      skills: ['Python', 'SQL', 'AI/ML', 'Data Pipelines'],
      hoursPerDay: 8,
      hourlyRate: 120,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: {}
    },
    {
      id: 'person-elena',
      scenarioId: baselineId,
      name: 'Elena Rostova',
      isPlaceholder: false,
      role: 'Product Manager',
      department: 'Product',
      skills: ['Strategy', 'Analytics', 'Roadmapping'],
      hoursPerDay: 8,
      hourlyRate: 105,
      costType: 'opex',
      startDate: null,
      endDate: null,
      meta: {}
    },
    {
      id: 'person-tbd-1',
      scenarioId: baselineId,
      name: 'TBD Senior Engineer (Q3 Hire)',
      isPlaceholder: true,
      role: 'Senior Engineer',
      department: 'Engineering',
      skills: ['React', 'TypeScript', 'Cloud'],
      hoursPerDay: 8,
      hourlyRate: 110,
      costType: 'capex',
      startDate: '2026-08-03',
      endDate: null,
      meta: {}
    }
  ]

  const projects: ScenarioDataset['projects'] = [
    {
      id: 'proj-enterprise-sso',
      scenarioId: baselineId,
      name: 'Enterprise SSO & Audit Vault',
      startDate: '2026-04-06',
      endDate: '2026-06-26',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 1,
      valueScore: 94,
      costMode: 'fixed',
      fixedCost: 115000,
      capexPercent: 80,
      blendedHourlyRate: 115,
      color: '#4f46e5',
      meta: {}
    },
    {
      id: 'proj-ai-copilot',
      scenarioId: baselineId,
      name: 'AI Forecasting Copilot v2',
      startDate: '2026-05-04',
      endDate: '2026-08-28',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 2,
      valueScore: 91,
      costMode: 'calculated',
      fixedCost: 28000, // Non-labor GPU/API vendor cost
      capexPercent: 75,
      blendedHourlyRate: 115,
      color: '#0d9488',
      meta: {}
    },
    {
      id: 'proj-cloud-migration',
      scenarioId: baselineId,
      name: 'Multi-Region Cloud Migration',
      startDate: '2026-06-01',
      endDate: '2026-08-21',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 3,
      valueScore: 82,
      costMode: 'fixed',
      fixedCost: 135000,
      capexPercent: 60,
      blendedHourlyRate: 115,
      color: '#d97706',
      meta: {}
    },
    {
      id: 'proj-mobile-exec',
      scenarioId: baselineId,
      name: 'Executive iPad & Boardroom Companion',
      startDate: '2026-07-06',
      endDate: '2026-10-30',
      status: 'timeline',
      certainty: 'tentative',
      priorityRank: 4,
      valueScore: 76,
      costMode: 'fixed',
      fixedCost: 92000,
      capexPercent: 70,
      blendedHourlyRate: 110,
      color: '#7c3aed',
      meta: {}
    },
    {
      id: 'proj-billing-revamp',
      scenarioId: baselineId,
      name: 'Usage-Based Billing Engine',
      startDate: '2026-09-07',
      endDate: '2026-11-27',
      status: 'on_deck',
      certainty: 'confirmed',
      priorityRank: 5,
      valueScore: 88,
      costMode: 'fixed',
      fixedCost: 78000,
      capexPercent: 85,
      blendedHourlyRate: 115,
      color: '#2563eb',
      meta: {}
    },
    {
      id: 'proj-soc2-automation',
      scenarioId: baselineId,
      name: 'SOC2 Continuous Compliance Portal',
      startDate: '2026-10-05',
      endDate: '2026-12-18',
      status: 'on_deck',
      certainty: 'tentative',
      priorityRank: 6,
      valueScore: 68,
      costMode: 'fixed',
      fixedCost: 54000,
      capexPercent: 40,
      blendedHourlyRate: 110,
      color: '#db2777',
      meta: {}
    }
  ]

  const assignments: ScenarioDataset['assignments'] = [
    // Enterprise SSO
    {
      id: 'asn-1',
      scenarioId: baselineId,
      projectId: 'proj-enterprise-sso',
      personId: 'person-adam',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Architecture', 'SQL'],
      allocationMode: 'total_hours',
      allocationValue: 300,
      meta: {}
    },
    {
      id: 'asn-2',
      scenarioId: baselineId,
      projectId: 'proj-enterprise-sso',
      personId: 'person-bob',
      requiredRole: 'Senior Engineer',
      requiredSkills: ['React', 'TypeScript'],
      allocationMode: 'total_hours',
      allocationValue: 260,
      meta: {}
    },
    {
      id: 'asn-3',
      scenarioId: baselineId,
      projectId: 'proj-enterprise-sso',
      personId: 'person-chris',
      requiredRole: 'Product Designer',
      requiredSkills: ['Design Systems'],
      allocationMode: 'total_hours',
      allocationValue: 140,
      meta: {}
    },
    // AI Copilot v2
    {
      id: 'asn-4',
      scenarioId: baselineId,
      projectId: 'proj-ai-copilot',
      personId: 'person-xavier',
      requiredRole: 'Data & AI Engineer',
      requiredSkills: ['Python', 'AI/ML'],
      allocationMode: 'hours_per_day',
      allocationValue: 6,
      meta: {}
    },
    {
      id: 'asn-5',
      scenarioId: baselineId,
      projectId: 'proj-ai-copilot',
      personId: 'person-elena',
      requiredRole: 'Product Manager',
      requiredSkills: ['Strategy', 'Analytics'],
      allocationMode: 'percent',
      allocationValue: 50,
      meta: {}
    },
    {
      id: 'asn-6',
      scenarioId: baselineId,
      projectId: 'proj-ai-copilot',
      personId: 'person-chris',
      requiredRole: 'Product Designer',
      requiredSkills: ['Prototyping'],
      allocationMode: 'total_hours',
      allocationValue: 200,
      meta: {}
    },
    // Multi-Region Cloud Migration (Creates intentional June/July capacity & budget spike in Baseline!)
    {
      id: 'asn-7',
      scenarioId: baselineId,
      projectId: 'proj-cloud-migration',
      personId: 'person-adam',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Cloud', 'Architecture'],
      allocationMode: 'total_hours',
      allocationValue: 360,
      meta: {}
    },
    {
      id: 'asn-8',
      scenarioId: baselineId,
      projectId: 'proj-cloud-migration',
      personId: 'person-bob',
      requiredRole: 'Senior Engineer',
      requiredSkills: ['Node.js'],
      allocationMode: 'total_hours',
      allocationValue: 320,
      meta: {}
    },
    {
      id: 'asn-9',
      scenarioId: baselineId,
      projectId: 'proj-cloud-migration',
      personId: 'person-xavier',
      requiredRole: 'Data & AI Engineer',
      requiredSkills: ['Data Pipelines'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    },
    // Executive iPad Companion
    {
      id: 'asn-10',
      scenarioId: baselineId,
      projectId: 'proj-mobile-exec',
      personId: 'person-chris',
      requiredRole: 'Product Designer',
      requiredSkills: ['Design Systems', 'Prototyping'],
      allocationMode: 'total_hours',
      allocationValue: 240,
      meta: {}
    },
    {
      id: 'asn-11',
      scenarioId: baselineId,
      projectId: 'proj-mobile-exec',
      personId: 'person-elena',
      requiredRole: 'Product Manager',
      requiredSkills: ['Roadmapping'],
      allocationMode: 'total_hours',
      allocationValue: 180,
      meta: {}
    },
    {
      id: 'asn-12',
      scenarioId: baselineId,
      projectId: 'proj-mobile-exec',
      personId: 'person-tbd-1',
      requiredRole: 'Senior Engineer',
      requiredSkills: ['React', 'TypeScript'],
      allocationMode: 'total_hours',
      allocationValue: 280,
      meta: {}
    },
    // On-Deck projects retain their pre-assigned people!
    {
      id: 'asn-13',
      scenarioId: baselineId,
      projectId: 'proj-billing-revamp',
      personId: 'person-bob',
      requiredRole: 'Senior Engineer',
      requiredSkills: ['TypeScript'],
      allocationMode: 'total_hours',
      allocationValue: 240,
      meta: {}
    }
  ]

  const milestones: ScenarioDataset['milestones'] = [
    {
      id: 'ms-1',
      scenarioId: baselineId,
      projectId: 'proj-enterprise-sso',
      name: 'Security Audit Sign-off',
      targetDate: '2026-05-20',
      color: '#10b981'
    },
    {
      id: 'ms-2',
      scenarioId: baselineId,
      projectId: 'proj-ai-copilot',
      name: 'Executive Beta Preview',
      targetDate: '2026-07-15',
      color: '#f59e0b'
    },
    {
      id: 'ms-3',
      scenarioId: baselineId,
      projectId: 'proj-cloud-migration',
      name: 'EU Region Cutover',
      targetDate: '2026-08-10',
      color: '#3b82f6'
    }
  ]

  const dependencies: ScenarioDataset['dependencies'] = [
    {
      id: 'dep-1',
      scenarioId: baselineId,
      fromProjectId: 'proj-enterprise-sso',
      toProjectId: 'proj-mobile-exec'
    }
  ]

  const holidays: ScenarioDataset['holidays'] = [
    {
      id: 'hol-memorial',
      scenarioId: baselineId,
      name: 'Memorial Day',
      startDate: '2026-05-25',
      endDate: '2026-05-25'
    },
    {
      id: 'hol-juneteenth',
      scenarioId: baselineId,
      name: 'Juneteenth',
      startDate: '2026-06-19',
      endDate: '2026-06-19'
    },
    {
      id: 'hol-july4',
      scenarioId: baselineId,
      name: 'Independence Day (Observed)',
      startDate: '2026-07-03',
      endDate: '2026-07-03'
    },
    {
      id: 'hol-labor',
      scenarioId: baselineId,
      name: 'Labor Day',
      startDate: '2026-09-07',
      endDate: '2026-09-07'
    },
    {
      id: 'hol-thanksgiving',
      scenarioId: baselineId,
      name: 'Thanksgiving Break',
      startDate: '2026-11-26',
      endDate: '2026-11-27'
    },
    {
      id: 'hol-winter',
      scenarioId: baselineId,
      name: 'Year-End Company Shutdown',
      startDate: '2026-12-24',
      endDate: '2026-12-31'
    }
  ]

  const timeOff: ScenarioDataset['timeOff'] = [
    {
      id: 'pto-1',
      scenarioId: baselineId,
      personId: 'person-adam',
      reason: 'Summer Family Vacation',
      startDate: '2026-07-13',
      endDate: '2026-07-17',
      hoursPerDayOff: 8
    }
  ]

  const monthlyBudgetValues = [
    85000, // Jan
    85000, // Feb
    90000, // Mar
    95000, // Apr
    105000, // May
    110000, // Jun (Baseline spikes above this!)
    110000, // Jul (Baseline spikes above this!)
    110000, // Aug
    100000, // Sep
    95000, // Oct
    90000, // Nov
    85000 // Dec
  ]

  const budgets: ScenarioDataset['budgets'] = monthlyBudgetValues.map((amt, idx) => ({
    scenarioId: baselineId,
    year: 2026,
    month: idx + 1,
    budgetAmount: amt,
    capexBudget: Math.round(amt * 0.7),
    opexBudget: Math.round(amt * 0.3),
    meta: {}
  }))

  const baseline: ScenarioDataset = {
    scenario: {
      id: baselineId,
      parentScenarioId: null,
      name: 'FY26 Official Baseline Plan',
      description: 'Current committed Q2–Q4 roadmap before resolving summer bottleneck',
      isBaseline: true,
      createdAt: now,
      meta: {}
    },
    projects,
    people,
    assignments,
    milestones,
    dependencies,
    holidays,
    timeOff,
    budgets
  }

  // Create a ready-to-compare What-If Scenario that shifts Cloud Migration to Sep–Nov and pulls TBD Hire earlier
  const whatIfProjects = projects.map((p) => {
    if (p.id === 'proj-cloud-migration') {
      return {
        ...p,
        scenarioId: whatIfId,
        startDate: '2026-08-17',
        endDate: '2026-11-06'
      }
    }
    return { ...p, scenarioId: whatIfId }
  })

  const whatIfPeople = people.map((p) => {
    if (p.id === 'person-tbd-1') {
      return {
        ...p,
        scenarioId: whatIfId,
        name: 'Sarah Jenkins (Hired Early - Jun 15)',
        isPlaceholder: false,
        startDate: '2026-06-15'
      }
    }
    return { ...p, scenarioId: whatIfId }
  })

  const whatIf: ScenarioDataset = {
    scenario: {
      id: whatIfId,
      parentScenarioId: baselineId,
      name: 'What-If: Stagger Cloud Migration + June Hire',
      description: 'Resolves June/July capacity & budget overruns by staggering Cloud Migration to Aug',
      isBaseline: false,
      createdAt: now,
      meta: {}
    },
    projects: whatIfProjects,
    people: whatIfPeople,
    assignments: assignments.map((a) => ({ ...a, scenarioId: whatIfId })),
    milestones: milestones.map((m) =>
      m.projectId === 'proj-cloud-migration'
        ? { ...m, scenarioId: whatIfId, targetDate: '2026-10-20' }
        : { ...m, scenarioId: whatIfId }
    ),
    dependencies: dependencies.map((d) => ({ ...d, scenarioId: whatIfId })),
    holidays: holidays.map((h) => ({ ...h, scenarioId: whatIfId })),
    timeOff: timeOff.map((t) => ({ ...t, scenarioId: whatIfId })),
    budgets: budgets.map((b) => ({ ...b, scenarioId: whatIfId }))
  }

  return { baseline, whatIf }
}
