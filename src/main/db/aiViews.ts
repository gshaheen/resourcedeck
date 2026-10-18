import type Database from 'better-sqlite3'
import type { ScenarioDataset } from '../../shared/types'
import { calculateScenarioMonthlyRollup } from '../../shared/engine/calculator'
import { compareScenarios } from '../../shared/engine/diffEngine'

/**
 * Initializes self-documenting AI tables (`_ai_readme`) and SQL views inside the `.rdeck` file
 * so ChatGPT, Claude Cowork, Gemini, or any SQLite-capable tool can query the plan immediately.
 */
export function initializeAiViewsAndReadme(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _ai_readme (
      topic TEXT PRIMARY KEY,
      explanation TEXT NOT NULL
    );

    CREATE VIEW IF NOT EXISTS v_ai_project_schedule AS
    SELECT
      s.name AS scenario_name,
      s.is_baseline AS is_baseline_scenario,
      p.id AS project_id,
      p.name AS project_name,
      p.status AS workflow_status,
      p.certainty AS pipeline_certainty,
      p.priority_rank,
      p.value_score AS strategic_roi_score,
      p.start_date,
      p.end_date,
      p.cost_mode,
      p.fixed_cost,
      p.capex_percent,
      COUNT(DISTINCT a.person_id) AS assigned_people_count
    FROM projects p
    JOIN scenarios s ON s.id = p.scenario_id
    LEFT JOIN assignments a ON a.scenario_id = p.scenario_id AND a.project_id = p.id
    GROUP BY p.scenario_id, p.id;

    CREATE VIEW IF NOT EXISTS v_ai_person_allocations AS
    SELECT
      s.name AS scenario_name,
      pe.id AS person_id,
      pe.name AS person_name,
      pe.is_placeholder AS is_tbd_placeholder,
      pe.role,
      pe.department,
      pe.hours_per_day,
      pe.hourly_rate,
      pe.start_date AS hire_date,
      pe.end_date AS departure_date,
      pr.id AS project_id,
      pr.name AS project_name,
      pr.status AS project_status,
      pr.certainty AS project_certainty,
      pr.start_date AS project_start,
      pr.end_date AS project_end,
      a.allocation_mode,
      a.allocation_value
    FROM assignments a
    JOIN scenarios s ON s.id = a.scenario_id
    JOIN people pe ON pe.scenario_id = a.scenario_id AND pe.id = a.person_id
    JOIN projects pr ON pr.scenario_id = a.scenario_id AND pr.id = a.project_id;

    CREATE VIEW IF NOT EXISTS v_ai_scenario_comparison AS
    SELECT
      curr.scenario_name AS what_if_scenario,
      curr.year_month,
      base.capacity_hours AS baseline_capacity_hours,
      curr.capacity_hours AS scenario_capacity_hours,
      base.total_demand_hours AS baseline_demand_hours,
      curr.total_demand_hours AS scenario_demand_hours,
      ROUND(curr.total_demand_hours - base.total_demand_hours, 1) AS demand_hours_delta,
      base.total_cost AS baseline_cost,
      curr.total_cost AS scenario_cost,
      ROUND(curr.total_cost - base.total_cost, 2) AS cost_delta,
      base.budget_amount,
      base.is_capacity_overrun AS baseline_capacity_overrun,
      curr.is_capacity_overrun AS scenario_capacity_overrun,
      base.is_budget_overrun AS baseline_budget_overrun,
      curr.is_budget_overrun AS scenario_budget_overrun
    FROM ai_monthly_rollup curr
    JOIN ai_monthly_rollup base
      ON base.is_baseline = 1 AND base.year_month = curr.year_month
    WHERE curr.is_baseline = 0;
  `)

  const upsertReadme = db.prepare(`
    INSERT INTO _ai_readme (topic, explanation)
    VALUES (@topic, @explanation)
    ON CONFLICT(topic) DO UPDATE SET explanation = excluded.explanation
  `)

  const readmeEntries = [
    {
      topic: '01_overview',
      explanation:
        'This .rdeck file is a resourcedeck portfolio & capacity database (SQLite 3). It contains Supply (people, roles, budgets, holidays, time_off) and Demand (projects, assignments, milestones, dependencies) across multiple What-If Scenarios.'
    },
    {
      topic: '02_recommended_tables_for_ai',
      explanation:
        'Start by querying `ai_monthly_rollup` (pre-calculated monthly capacity, demand hours, budgets, costs, CapEx/OpEx, and overrun flags for every scenario), `v_ai_project_schedule`, `v_ai_person_allocations`, and `v_ai_scenario_comparison`.'
    },
    {
      topic: '03_calculation_rules',
      explanation:
        'Only projects with status="timeline" contribute to active monthly demand and cost (projects with status="on_deck" are staged in the backlog). Project hours and costs are prorated across each calendar month based on working weekdays (Mon-Fri minus company holidays).'
    }
  ]

  const tx = db.transaction(() => {
    for (const entry of readmeEntries) {
      upsertReadme.run(entry)
    }
  })
  tx()
}

/**
 * Synchronizes the `ai_monthly_rollup` table for a given ScenarioDataset so the SQLite file
 * always has up-to-date pre-computed monthly metrics ready for external AI tools.
 */
export function syncAiMonthlyRollupForScenario(
  db: Database.Database,
  dataset: ScenarioDataset
): void {
  const rollups = calculateScenarioMonthlyRollup(dataset)

  const deleteStmt = db.prepare(`DELETE FROM ai_monthly_rollup WHERE scenario_id = ?`)
  const insertStmt = db.prepare(`
    INSERT INTO ai_monthly_rollup (
      scenario_id, scenario_name, is_baseline, year_month, year, month,
      working_weekdays, capacity_hours, confirmed_demand_hours, tentative_demand_hours,
      total_demand_hours, is_capacity_overrun, utilization_percent,
      budget_amount, confirmed_cost, tentative_cost, total_cost,
      labor_cost, non_labor_cost, capex_cost, opex_cost, is_budget_overrun
    ) VALUES (
      @scenarioId, @scenarioName, @isBaseline, @yearMonth, @year, @month,
      @workingWeekdays, @capacityHours, @confirmedDemandHours, @tentativeDemandHours,
      @totalDemandHours, @isCapacityOverrun, @utilizationPercent,
      @budgetAmount, @confirmedCost, @tentativeCost, @totalCost,
      @laborCost, @nonLaborCost, @capexCost, @opexCost, @isBudgetOverrun
    )
  `)

  const tx = db.transaction(() => {
    deleteStmt.run(dataset.scenario.id)
    for (const r of rollups) {
      insertStmt.run({
        scenarioId: dataset.scenario.id,
        scenarioName: dataset.scenario.name,
        isBaseline: dataset.scenario.isBaseline ? 1 : 0,
        yearMonth: r.yearMonth,
        year: r.year,
        month: r.month,
        workingWeekdays: r.workingWeekdays,
        capacityHours: r.capacityHours,
        confirmedDemandHours: r.confirmedDemandHours,
        tentativeDemandHours: r.tentativeDemandHours,
        totalDemandHours: r.totalDemandHours,
        isCapacityOverrun: r.isCapacityOverrun ? 1 : 0,
        utilizationPercent: r.utilizationPercent,
        budgetAmount: r.budgetAmount,
        confirmedCost: r.confirmedCost,
        tentativeCost: r.tentativeCost,
        totalCost: r.totalCost,
        laborCost: r.laborCost,
        nonLaborCost: r.nonLaborCost,
        capexCost: r.capexCost,
        opexCost: r.opexCost,
        isBudgetOverrun: r.isBudgetOverrun ? 1 : 0
      })
    }
  })

  tx()
}

/**
 * Generates a token-efficient Markdown + JSON AI Context Pack for clipboard copy or file export.
 */
export function generateAiContextPack(
  activeDataset: ScenarioDataset,
  baselineDataset?: ScenarioDataset
): {
  markdownPromptPack: string
  jsonBundle: string
} {
  const rollups = calculateScenarioMonthlyRollup(activeDataset)
  const diffReport =
    baselineDataset && baselineDataset.scenario.id !== activeDataset.scenario.id
      ? compareScenarios(baselineDataset, activeDataset)
      : null

  const activeRollupMonths = rollups.filter(
    (r) => r.capacityHours > 0 || r.totalDemandHours > 0 || r.budgetAmount > 0 || r.totalCost > 0
  )

  const mdLines: string[] = [
    `# resourcedeck Portfolio & Capacity Context Pack`,
    `Generated: ${new Date().toISOString()}`,
    `Active Scenario: **${activeDataset.scenario.name}** (${activeDataset.scenario.isBaseline ? 'Official Baseline' : 'What-If Scenario'})`,
    ``,
    `## 1. Executive Summary`,
    `- **People & Roles (${activeDataset.people.length})**: ${activeDataset.people.map((p) => `${p.name} (${p.role}${p.isPlaceholder ? ', TBD Hire' : ''})`).join(', ')}`,
    `- **Timeline Projects (${activeDataset.projects.filter((p) => p.status === 'timeline').length})**: ${activeDataset.projects.filter((p) => p.status === 'timeline').map((p) => `${p.name} [${p.startDate} to ${p.endDate}, $${p.fixedCost.toLocaleString()}, ${p.certainty}]`).join('; ')}`,
    `- **On-Deck Backlog Projects (${activeDataset.projects.filter((p) => p.status === 'on_deck').length})**: ${activeDataset.projects.filter((p) => p.status === 'on_deck').map((p) => `${p.name} [$${p.fixedCost.toLocaleString()}]`).join('; ') || 'None'}`,
    ``
  ]

  if (diffReport) {
    mdLines.push(
      `## 2. What-If Scenario Diff vs. Baseline (${diffReport.baselineScenario.name})`,
      `- **Net Spend Delta**: $${diffReport.summary.totalSpendDelta.toLocaleString()}`,
      `- **Net Demand Hours Delta**: ${diffReport.summary.totalHoursDelta} hrs`,
      `- **Overrun Months**: Baseline had ${diffReport.summary.baselineOverrunMonths} overrun months -> Current has ${diffReport.summary.currentOverrunMonths} overrun months`,
      ...diffReport.projectDiffs.map(
        (pd) =>
          `  - Project **${pd.projectName}** (${pd.changeType}): ${pd.baselineStartDate || 'N/A'}..${pd.baselineEndDate || 'N/A'} -> ${pd.currentStartDate || 'N/A'}..${pd.currentEndDate || 'N/A'} (Cost delta: $${pd.costDelta.toLocaleString()}, Hours delta: ${pd.hoursDelta}h)`
      ),
      ``
    )
  }

  mdLines.push(
    `## 3. Monthly Capacity vs. Demand & Budget vs. Cost Rollup`,
    `| Month | Working Days | Capacity (hrs) | Demand (hrs) | Util % | Budget ($) | Cost ($) | Overrun Alert |`,
    `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |`,
    ...activeRollupMonths.map((r) => {
      const alerts: string[] = []
      if (r.isCapacityOverrun) alerts.push(`+${r.capacityOverrunHours}h OVER CAPACITY`)
      if (r.isBudgetOverrun) alerts.push(`+$${r.budgetOverrunAmount.toLocaleString()} OVER BUDGET`)
      return `| ${r.yearMonth} | ${r.workingWeekdays} | ${r.capacityHours} | ${r.totalDemandHours} | ${r.utilizationPercent}% | $${r.budgetAmount.toLocaleString()} | $${r.totalCost.toLocaleString()} | ${alerts.join(', ') || 'OK'} |`
    }),
    ``
  )

  const jsonPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    activeScenario: activeDataset,
    monthlyRollup: activeRollupMonths,
    comparisonToBaseline: diffReport
  }

  return {
    markdownPromptPack: mdLines.join('\n'),
    jsonBundle: JSON.stringify(jsonPayload, null, 2)
  }
}
