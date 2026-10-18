# resourcedeck

**resourcedeck** is a local-first, privacy-focused executive desktop application for resource capacity, project portfolio scheduling, and "What-If" scenario planning.

## Key Capabilities

- **Interactive Portfolio Timeline & Drag-and-Drop**: Stage initiatives in *Projects on Deck*, drag them onto the timeline, drag bars left/right to shift schedules, drag bar edges to stretch or "squish" durations, and drag people onto projects to allocate hours.
- **Real-Time Supply vs. Demand & Financial Charts**: Live-updating *People Capacity vs. Demand (Hours)* and *Budgets vs. Project Costs ($)* charts with automatic **Overrun Red** highlighting, Person/Role/Department filtering, Confirmed vs. Tentative pipeline stacking, and Labor/Non-Labor + CapEx/OpEx breakdowns.
- **"What-If" Scenario Branching & Diff Engine**: Fork your Baseline plan in one click, visualize dashed **Baseline Ghost Bars** right on the Gantt timeline, inspect monthly delta lines, and review the **Scenario Diff Drawer** with one-click promotion to Baseline.
- **Team & Role Utilization Heatmap**: Color-coded matrix (`People × Months`) to spot bench availability (`<70%`), optimal load (`70–100%`), and over-allocation bottlenecks (`>100%`).
- **Smart Staffing &Realistic Availability**: Company-wide holiday calendar, personal PTO deductions, new-hire start dates, `TBD` role placeholders, and Smart Staffing suggestions ranked by open capacity and skill match.
- **AI-Ready `.rdeck` SQLite Data Layer**: Every `.rdeck` file is a fast, WAL-journaled SQLite database with 10 composite indexes, self-documenting `_ai_readme` + SQL views, pre-computed `ai_monthly_rollup`, and a 1-click **AI Data Bridge** (`Cmd/Ctrl + Shift + A`) for ChatGPT, Claude Cowork, and Gemini.
- **Presentation-Ready Studio Design**: Bundled locally with **Plus Jakarta Sans** (with OpenType tabular numerals) and **Fraunces** editorial headers, **6 curated themes**, and a 1-click **Presentation Mode** (`Cmd/Ctrl + P`).

## Development Commands

```bash
npm run dev        # Launch Electron app with Hot Reloading
npm test           # Run Vitest unit tests (< 1s)
npm run typecheck  # Run TypeScript compiler check
npm run build      # Build production bundles
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the complete solo-maintainer guide, schema migration instructions, and release workflow.
