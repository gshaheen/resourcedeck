# resourcedeck — Solo Maintainer & Development Playbook

This document is your single-page guide for developing, upgrading, testing, and releasing **resourcedeck** over the long term.

---

## 1. Quick Start & Daily Commands (Only 4 Commands)

| Command | What It Does |
| :--- | :--- |
| `npm run dev` | Launches the Electron desktop app in development mode with instant React Hot Module Replacement (HMR). |
| `npm test` | Runs the Vitest unit test suite (`src/shared/__tests__/engine.test.ts`) in `< 1 second`, verifying the 2011 spec weekday proration math, holiday/PTO deductions, scenario diffs, smart staffing, and `.rdeck` SQLite persistence. |
| `npm run typecheck` | Runs strict TypeScript (`tsc --noEmit`) across Main, Preload, Shared, and Renderer processes. |
| `npm run release` | Builds the production bundle and runs `electron-builder` to package, sign, and publish macOS (`.dmg`/`.zip`) and Windows (`.exe`) installers to GitHub Releases. |

---

## 2. Architecture & Where Everything Lives

```text
resourcedeck/
├── electron.vite.config.ts      # Unified build config for Main, Preload & Renderer
├── electron-builder.yml         # macOS/Windows installer, .rdeck file association & auto-updater
├── src/
│   ├── shared/                  # Pure TypeScript shared by both Node (Main) & React (Renderer)
│   │   ├── types.ts             # Canonical interfaces (Project, Person, Scenario, MonthlyRollup)
│   │   ├── schemas.ts           # Zod validation schemas
│   │   ├── engine/              # ZERO UI/DB dependencies — 100% pure deterministic functions
│   │   │   ├── calculator.ts    # Weekday, holiday, PTO, capacity, cost & heatmap calculators
│   │   │   ├── diffEngine.ts    # Baseline vs. What-If scenario comparison engine
│   │   │   ├── smartStaff.ts    # Skill & availability ranking algorithm
│   │   │   └── sampleData.ts    # Default executive portfolio seeded on first run
│   │   └── __tests__/           # Vitest unit tests
│   ├── main/                    # Electron Main Process (Node.js)
│   │   ├── index.ts             # App window, .rdeck OS file association, zero-telemetry updater
│   │   ├── ipc.ts               # IPC handlers bridging Renderer <-> SQLite
│   │   └── db/
│   │       ├── database.ts      # better-sqlite3 engine, WAL pragmas, atomic transactions
│   │       ├── migrations.ts    # Ordered SQL schema migrations + 10 composite B-tree indexes
│   │       └── aiViews.ts       # _ai_readme, SQL views, ai_monthly_rollup sync & AI Prompt Pack
│   ├── preload/                 # Context-isolated window.rdeck bridge
│   └── renderer/                # React 19 UI
│       ├── index.html           # FOUC-free theme initializer
│       └── src/
│           ├── styles/themes.css        # 6 curated themes + Plus Jakarta Sans & Fraunces fonts
│           ├── store/useDeckStore.ts    # Zustand reactive store + Zundo undo/redo + auto-save
│           └── components/
│               ├── TopBar.tsx           # File switcher, Scenario selector, View switcher, Themes
│               ├── LeftSidebar.tsx      # Set Budgets, Holidays, Projects on Deck, People list
│               ├── GanttTimeline.tsx    # Drag/resize bars, ghost bars, milestones, inline popover
│               ├── ChartsPanel.tsx      # Capacity vs. Demand & Budgets vs. Costs Recharts
│               ├── UtilizationHeatmap.tsx # Team & Role Utilization Heatmap matrix
│               ├── ScenarioDiffDrawer.tsx # What-If diff drawer & Promote to Baseline
│               ├── ExecutiveKpiBar.tsx  # Boardroom KPI summary cards
│               └── ModalsContainer.tsx  # Batch modals + Excel/CSV paste + AI Data Bridge
```

---

## 3. How to Evolve the Data Layer Without Breaking Old `.rdeck` Files

Every `.rdeck` file is a standard SQLite 3 database with `PRAGMA user_version` tracking its schema version.

### Option A: Fast Attribute Additions (Zero Schema Migration Needed)
Every core table (`scenarios`, `projects`, `people`, `assignments`, `budgets`) has a `meta TEXT NOT NULL DEFAULT '{}'` JSON column.
- If you want to store a lightweight new property (e.g., `project.meta.jiraUrl`), simply read/write it on `project.meta`. It saves automatically and older app versions preserve it untouched.

### Option B: Adding New Columns or Tables (Ordered SQLite Migration)
1. Open [`src/main/db/migrations.ts`](file:///Users/georgeshaheen/Desktop/repos/resourcedeck/src/main/db/migrations.ts).
2. Append a new migration object with `version: 2` (or `N + 1`):
   ```ts
   {
     version: 2,
     description: 'Add sponsor column to projects',
     up: `ALTER TABLE projects ADD COLUMN sponsor TEXT NOT NULL DEFAULT '';`
   }
   ```
3. **Automatic Safety Net**: Whenever a user opens a `v1` `.rdeck` file in the upgraded `v2` app, `applyMigrations()` in `migrations.ts` automatically creates a timestamped backup (`MyPlan.rdeck.backup-v1-<timestamp>.rdeck`) **before** running the `v2` migration inside a single SQLite transaction.

---

## 4. How AI Tools Access `.rdeck` Data

1. **Direct SQLite Access (Claude Cowork, ChatGPT Data Analysis, Gemini, Python/SQL)**:
   - Any tool that can read a SQLite file can open `MyPlan.rdeck` directly.
   - `_ai_readme` explains the schema and weekday proration rules in plain English.
   - `ai_monthly_rollup` is automatically updated on every save so AI tools can query exact monthly capacity, demand hours, budgets, costs, CapEx/OpEx, and overrun flags without writing date math.
   - Pre-built SQL views (`v_ai_project_schedule`, `v_ai_person_allocations`, `v_ai_scenario_comparison`) give one-query answers.
2. **In-App AI Data Bridge (`Cmd/Ctrl + Shift + A`)**:
   - Copies a clean Markdown + Monthly Rollup prompt pack to the clipboard or exports a full JSON bundle.

---

## 5. Browser & Runtime Support Policy

- **Target Runtime**: Electron 34+ (Chromium 132+).
- Because resourcedeck runs inside a controlled modern Chromium desktop environment, modern CSS features (`color-scheme`, custom properties, native `<input type="date">`, CSS Grid sticky headers, standard `scrollbar-color` with progressive enhancement) are supported natively without legacy browser polyfills.

---

## 6. Releasing Updates & Tracking Downloads (Zero Telemetry)

1. Bump `"version"` in `package.json` (e.g., `"1.1.0"`).
2. Run `npm test && npm run typecheck`.
3. Set `GH_TOKEN` to your GitHub Personal Access Token and run `npm run release`.
4. `electron-builder` builds and uploads the signed binaries + `latest-mac.yml` / `latest.yml` to **GitHub Releases**.
5. Existing installations running `electron-updater` silently download the update in the background and show the *"Restart to Update"* banner.
6. **Download Counts without Telemetry**: Query the GitHub Releases API (`gh api repos/<owner>/<repo>/releases`) to see exact download counts per release asset while keeping the app 100% private and telemetry-free.
