import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import type {
  Assignment,
  Dependency,
  Holiday,
  Milestone,
  MonthlyBudget,
  Person,
  Project,
  Scenario,
  ScenarioDataset,
  TimeOff
} from '../../shared/types'
import { createSamplePortfolio } from '../../shared/engine/sampleData'
import { applyMigrations } from './migrations'
import { initializeAiViewsAndReadme, syncAiMonthlyRollupForScenario } from './aiViews'

export class RDeckDatabase {
  private db: Database.Database | null = null
  private currentFilePath: string | null = null

  /**
   * Opens or creates a `.rdeck` SQLite file at `filePath`.
   * Applies WAL & performance pragmas, runs pending schema migrations (creating a backup first if upgrading),
   * initializes AI views, and seeds sample data if the database is brand new and `seedIfEmpty` is true.
   */
  public openFile(filePath: string, seedIfEmpty = true): {
    filePath: string
    scenarios: Scenario[]
    activeScenario: ScenarioDataset
  } {
    this.close()

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const db = new Database(filePath)
    this.db = db
    this.currentFilePath = filePath

    // High-performance SQLite Pragmas
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
    db.pragma('temp_store = MEMORY')
    db.pragma('cache_size = -32000')

    // Apply ordered migrations with automatic pre-upgrade backup
    applyMigrations(db, (oldVersion, newVersion) => {
      const backupPath = `${filePath}.backup-v${oldVersion}-${Date.now()}.rdeck`
      try {
        fs.copyFileSync(filePath, backupPath)
      } catch {
        // Ignore if file copy fails on read-only path
      }
      console.log(`Upgrading .rdeck schema from v${oldVersion} to v${newVersion}`)
    })

    initializeAiViewsAndReadme(db)

    let scenarios = this.listScenarios()
    if (scenarios.length === 0 && seedIfEmpty) {
      const sample = createSamplePortfolio()
      this.saveScenarioDataset(sample.baseline)
      this.saveScenarioDataset(sample.whatIf)
      scenarios = this.listScenarios()
    } else if (scenarios.length === 0) {
      const defaultBaseline: ScenarioDataset = {
        scenario: {
          id: 'scen-baseline',
          parentScenarioId: null,
          name: 'Baseline Plan',
          description: 'Primary portfolio plan',
          isBaseline: true,
          createdAt: new Date().toISOString(),
          meta: {}
        },
        projects: [],
        people: [],
        assignments: [],
        milestones: [],
        dependencies: [],
        holidays: [],
        timeOff: [],
        budgets: []
      }
      this.saveScenarioDataset(defaultBaseline)
      scenarios = this.listScenarios()
    }

    const baselineOrFirst = scenarios.find((s) => s.isBaseline) || scenarios[0]
    const activeScenario = this.loadScenarioDataset(baselineOrFirst.id)

    return {
      filePath,
      scenarios,
      activeScenario
    }
  }

  public getFilePath(): string | null {
    return this.currentFilePath
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.pragma('wal_checkpoint(TRUNCATE)')
        this.db.close()
      } catch {
        // Ignore close errors
      }
      this.db = null
      this.currentFilePath = null
    }
  }

  private ensureDb(): Database.Database {
    if (!this.db) {
      throw new Error('No .rdeck database is currently open.')
    }
    return this.db
  }

  public listScenarios(): Scenario[] {
    const db = this.ensureDb()
    const rows = db
      .prepare(
        `SELECT * FROM scenarios ORDER BY is_baseline DESC, created_at ASC`
      )
      .all() as Record<string, unknown>[]

    return rows.map((r) => ({
      id: String(r.id),
      parentScenarioId: r.parent_scenario_id ? String(r.parent_scenario_id) : null,
      name: String(r.name),
      description: String(r.description || ''),
      isBaseline: Boolean(r.is_baseline),
      createdAt: String(r.created_at),
      meta: safeParseJson(String(r.meta), {})
    }))
  }

  public loadScenarioDataset(scenarioId: string): ScenarioDataset {
    const db = this.ensureDb()
    const scenRow = db
      .prepare(`SELECT * FROM scenarios WHERE id = ?`)
      .get(scenarioId) as Record<string, unknown> | undefined

    if (!scenRow) {
      throw new Error(`Scenario ${scenarioId} not found in .rdeck file`)
    }

    const scenario: Scenario = {
      id: String(scenRow.id),
      parentScenarioId: scenRow.parent_scenario_id
        ? String(scenRow.parent_scenario_id)
        : null,
      name: String(scenRow.name),
      description: String(scenRow.description || ''),
      isBaseline: Boolean(scenRow.is_baseline),
      createdAt: String(scenRow.created_at),
      meta: safeParseJson(String(scenRow.meta), {})
    }

    const projectRows = db
      .prepare(
        `SELECT * FROM projects WHERE scenario_id = ? ORDER BY priority_rank ASC, start_date ASC`
      )
      .all(scenarioId) as Record<string, unknown>[]

    const projects: Project[] = projectRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      name: String(r.name),
      startDate: String(r.start_date),
      endDate: String(r.end_date),
      status: (r.status as Project['status']) || 'on_deck',
      certainty: (r.certainty as Project['certainty']) || 'confirmed',
      priorityRank: Number(r.priority_rank ?? 1),
      valueScore: Number(r.value_score ?? 75),
      costMode: (r.cost_mode as Project['costMode']) || 'fixed',
      fixedCost: Number(r.fixed_cost ?? 0),
      capexPercent: Number(r.capex_percent ?? 0),
      blendedHourlyRate: Number(r.blended_hourly_rate ?? 0),
      color: String(r.color || '#4f46e5'),
      meta: safeParseJson(String(r.meta), {})
    }))

    const peopleRows = db
      .prepare(`SELECT * FROM people WHERE scenario_id = ? ORDER BY is_placeholder ASC, name ASC`)
      .all(scenarioId) as Record<string, unknown>[]

    const people: Person[] = peopleRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      name: String(r.name),
      isPlaceholder: Boolean(r.is_placeholder),
      role: String(r.role || 'General'),
      department: String(r.department || 'Delivery'),
      skills: safeParseJson<string[]>(String(r.skills), []),
      hoursPerDay: Number(r.hours_per_day ?? 8),
      hourlyRate: Number(r.hourly_rate ?? 0),
      costType: (r.cost_type as Person['costType']) || 'project_default',
      startDate: r.start_date ? String(r.start_date) : null,
      endDate: r.end_date ? String(r.end_date) : null,
      meta: safeParseJson(String(r.meta), {})
    }))

    const assignmentRows = db
      .prepare(`SELECT * FROM assignments WHERE scenario_id = ?`)
      .all(scenarioId) as Record<string, unknown>[]

    const assignments: Assignment[] = assignmentRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      projectId: String(r.project_id),
      personId: String(r.person_id),
      requiredRole: String(r.required_role || ''),
      requiredSkills: safeParseJson<string[]>(String(r.required_skills), []),
      allocationMode: (r.allocation_mode as Assignment['allocationMode']) || 'total_hours',
      allocationValue: Number(r.allocation_value ?? 0),
      meta: safeParseJson(String(r.meta), {})
    }))

    const milestoneRows = db
      .prepare(`SELECT * FROM milestones WHERE scenario_id = ? ORDER BY target_date ASC`)
      .all(scenarioId) as Record<string, unknown>[]

    const milestones: Milestone[] = milestoneRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      projectId: String(r.project_id),
      name: String(r.name),
      targetDate: String(r.target_date),
      color: String(r.color || '#10b981')
    }))

    const depRows = db
      .prepare(`SELECT * FROM dependencies WHERE scenario_id = ?`)
      .all(scenarioId) as Record<string, unknown>[]

    const dependencies: Dependency[] = depRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      fromProjectId: String(r.from_project_id),
      toProjectId: String(r.to_project_id)
    }))

    const holidayRows = db
      .prepare(`SELECT * FROM holidays WHERE scenario_id = ? ORDER BY start_date ASC`)
      .all(scenarioId) as Record<string, unknown>[]

    const holidays: Holiday[] = holidayRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      name: String(r.name),
      startDate: String(r.start_date),
      endDate: String(r.end_date)
    }))

    const timeOffRows = db
      .prepare(`SELECT * FROM time_off WHERE scenario_id = ? ORDER BY start_date ASC`)
      .all(scenarioId) as Record<string, unknown>[]

    const timeOff: TimeOff[] = timeOffRows.map((r) => ({
      id: String(r.id),
      scenarioId: String(r.scenario_id),
      personId: String(r.person_id),
      reason: String(r.reason || 'PTO'),
      startDate: String(r.start_date),
      endDate: String(r.end_date),
      hoursPerDayOff: Number(r.hours_per_day_off ?? 8)
    }))

    const budgetRows = db
      .prepare(`SELECT * FROM budgets WHERE scenario_id = ? ORDER BY year ASC, month ASC`)
      .all(scenarioId) as Record<string, unknown>[]

    const budgets: MonthlyBudget[] = budgetRows.map((r) => ({
      scenarioId: String(r.scenario_id),
      year: Number(r.year),
      month: Number(r.month),
      budgetAmount: Number(r.budget_amount ?? 0),
      capexBudget: Number(r.capex_budget ?? 0),
      opexBudget: Number(r.opex_budget ?? 0),
      meta: safeParseJson(String(r.meta), {})
    }))

    return {
      scenario,
      projects,
      people,
      assignments,
      milestones,
      dependencies,
      holidays,
      timeOff,
      budgets
    }
  }

  /**
   * Atomically persists an entire ScenarioDataset into the `.rdeck` file in < 1ms
   * and refreshes the `ai_monthly_rollup` table for AI tools.
   */
  public saveScenarioDataset(dataset: ScenarioDataset): void {
    const db = this.ensureDb()
    const sid = dataset.scenario.id

    const upsertScenario = db.prepare(`
      INSERT INTO scenarios (id, parent_scenario_id, name, description, is_baseline, created_at, meta)
      VALUES (@id, @parentScenarioId, @name, @description, @isBaseline, @createdAt, @meta)
      ON CONFLICT(id) DO UPDATE SET
        parent_scenario_id = excluded.parent_scenario_id,
        name = excluded.name,
        description = excluded.description,
        is_baseline = excluded.is_baseline,
        meta = excluded.meta
    `)

    const insertProject = db.prepare(`
      INSERT INTO projects (
        id, scenario_id, name, start_date, end_date, status, certainty,
        priority_rank, value_score, cost_mode, fixed_cost, capex_percent,
        blended_hourly_rate, color, meta
      ) VALUES (
        @id, @scenarioId, @name, @startDate, @endDate, @status, @certainty,
        @priorityRank, @valueScore, @costMode, @fixedCost, @capexPercent,
        @blendedHourlyRate, @color, @meta
      )
    `)

    const insertPerson = db.prepare(`
      INSERT INTO people (
        id, scenario_id, name, is_placeholder, role, department, skills,
        hours_per_day, hourly_rate, cost_type, start_date, end_date, meta
      ) VALUES (
        @id, @scenarioId, @name, @isPlaceholder, @role, @department, @skills,
        @hoursPerDay, @hourlyRate, @costType, @startDate, @endDate, @meta
      )
    `)

    const insertAssignment = db.prepare(`
      INSERT INTO assignments (
        id, scenario_id, project_id, person_id, required_role,
        required_skills, allocation_mode, allocation_value, meta
      ) VALUES (
        @id, @scenarioId, @projectId, @personId, @requiredRole,
        @requiredSkills, @allocationMode, @allocationValue, @meta
      )
    `)

    const insertMilestone = db.prepare(`
      INSERT INTO milestones (id, scenario_id, project_id, name, target_date, color)
      VALUES (@id, @scenarioId, @projectId, @name, @targetDate, @color)
    `)

    const insertDependency = db.prepare(`
      INSERT INTO dependencies (id, scenario_id, from_project_id, to_project_id)
      VALUES (@id, @scenarioId, @fromProjectId, @toProjectId)
    `)

    const insertHoliday = db.prepare(`
      INSERT INTO holidays (id, scenario_id, name, start_date, end_date)
      VALUES (@id, @scenarioId, @name, @startDate, @endDate)
    `)

    const insertTimeOff = db.prepare(`
      INSERT INTO time_off (id, scenario_id, person_id, reason, start_date, end_date, hours_per_day_off)
      VALUES (@id, @scenarioId, @personId, @reason, @startDate, @endDate, @hoursPerDayOff)
    `)

    const insertBudget = db.prepare(`
      INSERT INTO budgets (scenario_id, year, month, budget_amount, capex_budget, opex_budget, meta)
      VALUES (@scenarioId, @year, @month, @budgetAmount, @capexBudget, @opexBudget, @meta)
    `)

    const tx = db.transaction(() => {
      upsertScenario.run({
        id: dataset.scenario.id,
        parentScenarioId: dataset.scenario.parentScenarioId,
        name: dataset.scenario.name,
        description: dataset.scenario.description,
        isBaseline: dataset.scenario.isBaseline ? 1 : 0,
        createdAt: dataset.scenario.createdAt,
        meta: JSON.stringify(dataset.scenario.meta || {})
      })

      db.prepare(`DELETE FROM projects WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM people WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM assignments WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM milestones WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM dependencies WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM holidays WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM time_off WHERE scenario_id = ?`).run(sid)
      db.prepare(`DELETE FROM budgets WHERE scenario_id = ?`).run(sid)

      for (const p of dataset.projects) {
        insertProject.run({
          ...p,
          scenarioId: sid,
          meta: JSON.stringify(p.meta || {})
        })
      }

      for (const pe of dataset.people) {
        insertPerson.run({
          ...pe,
          scenarioId: sid,
          isPlaceholder: pe.isPlaceholder ? 1 : 0,
          skills: JSON.stringify(pe.skills || []),
          meta: JSON.stringify(pe.meta || {})
        })
      }

      for (const a of dataset.assignments) {
        insertAssignment.run({
          ...a,
          scenarioId: sid,
          requiredSkills: JSON.stringify(a.requiredSkills || []),
          meta: JSON.stringify(a.meta || {})
        })
      }

      for (const m of dataset.milestones) {
        insertMilestone.run({ ...m, scenarioId: sid })
      }

      for (const d of dataset.dependencies) {
        insertDependency.run({ ...d, scenarioId: sid })
      }

      for (const h of dataset.holidays) {
        insertHoliday.run({ ...h, scenarioId: sid })
      }

      for (const t of dataset.timeOff) {
        insertTimeOff.run({ ...t, scenarioId: sid })
      }

      for (const b of dataset.budgets) {
        insertBudget.run({
          ...b,
          scenarioId: sid,
          meta: JSON.stringify(b.meta || {})
        })
      }
    })

    tx()
    syncAiMonthlyRollupForScenario(db, dataset)
  }

  /**
   * Duplicates an existing scenario into a new "What-If" scenario, preserving all entity IDs
   * so the Diff Engine can compare projects and people 1-to-1 across scenarios.
   */
  public duplicateScenario(
    sourceScenarioId: string,
    newName: string,
    newDescription = ''
  ): ScenarioDataset {
    const source = this.loadScenarioDataset(sourceScenarioId)
    const newId = `scen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const forked: ScenarioDataset = {
      scenario: {
        id: newId,
        parentScenarioId: source.scenario.id,
        name: newName,
        description: newDescription,
        isBaseline: false,
        createdAt: new Date().toISOString(),
        meta: {}
      },
      projects: source.projects.map((p) => ({ ...p, scenarioId: newId })),
      people: source.people.map((pe) => ({ ...pe, scenarioId: newId })),
      assignments: source.assignments.map((a) => ({ ...a, scenarioId: newId })),
      milestones: source.milestones.map((m) => ({ ...m, scenarioId: newId })),
      dependencies: source.dependencies.map((d) => ({ ...d, scenarioId: newId })),
      holidays: source.holidays.map((h) => ({ ...h, scenarioId: newId })),
      timeOff: source.timeOff.map((t) => ({ ...t, scenarioId: newId })),
      budgets: source.budgets.map((b) => ({ ...b, scenarioId: newId }))
    }

    this.saveScenarioDataset(forked)
    return forked
  }

  /**
   * Promotes a What-If scenario to become the official Baseline scenario.
   */
  public promoteScenarioToBaseline(scenarioId: string): Scenario[] {
    const db = this.ensureDb()
    const tx = db.transaction(() => {
      db.prepare(`UPDATE scenarios SET is_baseline = 0`).run()
      db.prepare(`UPDATE scenarios SET is_baseline = 1, parent_scenario_id = NULL WHERE id = ?`).run(
        scenarioId
      )
      db.prepare(`UPDATE ai_monthly_rollup SET is_baseline = 0`).run()
      db.prepare(`UPDATE ai_monthly_rollup SET is_baseline = 1 WHERE scenario_id = ?`).run(
        scenarioId
      )
    })
    tx()
    return this.listScenarios()
  }

  public deleteScenario(scenarioId: string): Scenario[] {
    const db = this.ensureDb()
    const scenarios = this.listScenarios()
    if (scenarios.length <= 1) {
      throw new Error('Cannot delete the only scenario in a plan.')
    }
    db.prepare(`DELETE FROM scenarios WHERE id = ?`).run(scenarioId)
    const remaining = this.listScenarios()
    if (!remaining.some((s) => s.isBaseline)) {
      this.promoteScenarioToBaseline(remaining[0].id)
      return this.listScenarios()
    }
    return remaining
  }
}

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
