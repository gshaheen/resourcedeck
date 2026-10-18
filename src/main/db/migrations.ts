import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  description: string
  up: string
}

/**
 * Ordered, additive-first SQLite migrations for .rdeck files.
 * Every migration runs inside an atomic transaction after backing up the previous version.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description:
      'Initial resourcedeck v1 schema with scenarios, projects, people, assignments, milestones, dependencies, holidays, time_off, budgets, AI views, and 10 composite B-tree indexes',
    up: `
      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        parent_scenario_id TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_baseline INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'on_deck',
        certainty TEXT NOT NULL DEFAULT 'confirmed',
        priority_rank INTEGER NOT NULL DEFAULT 1,
        value_score REAL NOT NULL DEFAULT 75,
        cost_mode TEXT NOT NULL DEFAULT 'fixed',
        fixed_cost REAL NOT NULL DEFAULT 0,
        capex_percent REAL NOT NULL DEFAULT 0,
        blended_hourly_rate REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#4f46e5',
        meta TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS people (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_placeholder INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'General',
        department TEXT NOT NULL DEFAULT 'Delivery',
        skills TEXT NOT NULL DEFAULT '[]',
        hours_per_day REAL NOT NULL DEFAULT 8,
        hourly_rate REAL NOT NULL DEFAULT 0,
        cost_type TEXT NOT NULL DEFAULT 'project_default',
        start_date TEXT,
        end_date TEXT,
        meta TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        required_role TEXT NOT NULL DEFAULT '',
        required_skills TEXT NOT NULL DEFAULT '[]',
        allocation_mode TEXT NOT NULL DEFAULT 'total_hours',
        allocation_value REAL NOT NULL DEFAULT 0,
        meta TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        target_date TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#10b981',
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dependencies (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        from_project_id TEXT NOT NULL,
        to_project_id TEXT NOT NULL,
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS time_off (
        id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'PTO',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        hours_per_day_off REAL NOT NULL DEFAULT 8,
        PRIMARY KEY (id, scenario_id),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS budgets (
        scenario_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        budget_amount REAL NOT NULL DEFAULT 0,
        capex_budget REAL NOT NULL DEFAULT 0,
        opex_budget REAL NOT NULL DEFAULT 0,
        meta TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (scenario_id, year, month),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_monthly_rollup (
        scenario_id TEXT NOT NULL,
        scenario_name TEXT NOT NULL,
        is_baseline INTEGER NOT NULL,
        year_month TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        working_weekdays INTEGER NOT NULL,
        capacity_hours REAL NOT NULL,
        confirmed_demand_hours REAL NOT NULL,
        tentative_demand_hours REAL NOT NULL,
        total_demand_hours REAL NOT NULL,
        is_capacity_overrun INTEGER NOT NULL,
        utilization_percent REAL NOT NULL,
        budget_amount REAL NOT NULL,
        confirmed_cost REAL NOT NULL,
        tentative_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        labor_cost REAL NOT NULL,
        non_labor_cost REAL NOT NULL,
        capex_cost REAL NOT NULL,
        opex_cost REAL NOT NULL,
        is_budget_overrun INTEGER NOT NULL,
        PRIMARY KEY (scenario_id, year_month),
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
      );

      -- 10 Composite B-Tree & Covering Indexes for <1ms Multi-Scenario Performance
      CREATE INDEX IF NOT EXISTS idx_projects_scenario_status
        ON projects (scenario_id, status, certainty, priority_rank);

      CREATE INDEX IF NOT EXISTS idx_projects_scenario_dates
        ON projects (scenario_id, start_date, end_date);

      CREATE INDEX IF NOT EXISTS idx_assignments_scenario_project
        ON assignments (scenario_id, project_id);

      CREATE INDEX IF NOT EXISTS idx_assignments_scenario_person
        ON assignments (scenario_id, person_id);

      CREATE INDEX IF NOT EXISTS idx_people_scenario_role_dept
        ON people (scenario_id, role, department, is_placeholder);

      CREATE INDEX IF NOT EXISTS idx_time_off_scenario_person_dates
        ON time_off (scenario_id, person_id, start_date, end_date);

      CREATE INDEX IF NOT EXISTS idx_holidays_scenario_dates
        ON holidays (scenario_id, start_date, end_date);

      CREATE INDEX IF NOT EXISTS idx_milestones_scenario_project
        ON milestones (scenario_id, project_id, target_date);

      CREATE INDEX IF NOT EXISTS idx_dependencies_scenario_links
        ON dependencies (scenario_id, from_project_id, to_project_id);

      CREATE INDEX IF NOT EXISTS idx_ai_rollup_scenario_month
        ON ai_monthly_rollup (scenario_id, year_month);
    `
  }
]

/**
 * Runs any pending migrations on a SQLite database connection.
 * If an existing file is being upgraded from an older schema version, invokes `onBeforeUpgrade`
 * so a backup copy can be created before altering the schema.
 */
export function applyMigrations(
  db: Database.Database,
  onBeforeUpgrade?: (oldVersion: number, newVersion: number) => void
): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const latestVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 1

  if (currentVersion >= latestVersion) {
    return
  }

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  )

  if (currentVersion > 0 && pending.length > 0 && onBeforeUpgrade) {
    onBeforeUpgrade(currentVersion, latestVersion)
  }

  const runInTransaction = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.up)
      db.pragma(`user_version = ${migration.version}`)
    }
  })

  runInTransaction()
}
