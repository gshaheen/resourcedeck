<!-- impeccable:product-schema 1 -->

# Product

## Platform
web

## Users
Engineering managers, PMO leads, directors, and portfolio decision-makers who need to balance organizational supply (people, roles, hiring placeholders, working calendars, and monthly budgets) against demand (scheduled timeline projects and unscheduled backlog candidates). They often operate the product live during executive review sessions, Zoom screen-shares, and conference room planning meetings where clarity, legibility, and immediate answers to "what happens if we move this?" matter.

## Product Purpose
resourcedeck solves the disconnect between spreadsheet capacity trackers, static slide decks, and heavyweight enterprise PPM tools. Users come to resourcedeck to model their people and budget supply against their project portfolio on an interactive timeline, test "What-If" scenario branches safely against a locked baseline, spot role or person over-allocations and budget overruns immediately, and present a clear, trustworthy plan to decision-makers.

## Positioning
A local-first, presentation-ready desktop portfolio and resource capacity workbench (`Electron` + `.rdeck` single-file SQLite database). Unlike bloated cloud PPM suites that require months of onboarding or fragile spreadsheets that break during live scenario modeling, resourcedeck combines tactile drag-and-drop Gantt scheduling, synchronized financial and utilization analytics, instant What-If scenario diffing, and an open AI-ready SQLite data layer with zero telemetry.

## Operating Context
- **Desktop workspace & live presentation**: Used on macOS and Windows desktop displays at varying window dimensions—both as a daily planning workbench at a manager's desk and projected live in boardrooms or shared over Zoom.
- **High numerical density**: Users scan across 12+ months of financial budgets, CapEx/OpEx splits, Confirmed vs. Tentative project pipelines, and individual FTE utilization percentages.
- **Offline & local-first**: Runs 100% offline against self-contained `.rdeck` files stored on the user's local filesystem or shared folders, with instant WAL-backed auto-save.

## Capabilities and Constraints
- **Single-file `.rdeck` SQLite architecture**: Every plan is a durable, portable SQLite database with forward-compatible schema migrations (`PRAGMA user_version`), automatic pre-upgrade backups, and extensible `meta` JSON columns.
- **AI-ready data layer**: Includes self-documenting schema metadata (`_ai_readme`), pre-joined SQL views (`v_ai_project_schedule`, `v_ai_person_allocations`, `v_ai_scenario_comparison`), materialized monthly rollups (`ai_monthly_rollup`), and a 1-click AI Data Bridge for external AI tools (ChatGPT, Claude, Cowork, Gemini, Cursor) without embedding an LLM inside the app.
- **Zero telemetry**: Strictly local-first and privacy-preserving; download counts are tracked solely via GitHub Release asset counters, with auto-updates handled via `electron-updater`.
- **Solo-maintainer velocity**: Built on a clean, well-documented Electron + React + TypeScript + Tailwind v4 + `better-sqlite3` stack with a pure deterministic calculation engine that is easy for a single developer to maintain and extend over years.

## Brand Commitments
- **Strict lowercase naming & microcosm block mark**: Always written as `"resourcedeck"`—one word, all lower case. In the interface, the shortened form is either `"rd"` or a single square flat block (`■`), representing what the product does at a microcosm level (allocating and arranging discrete blocks of capacity and projects).
- **Simple, technical, architectural, and elegant**: Grounded in a crisp, high-contrast light default (`Boardroom Daylight`) with zero AI-style design tropes (no glowing neon gradients, decorative sparkles, or terminal-style interfaces).
- **Editorial numerical legibility**: Uses `Plus Jakarta Sans Variable` with strict `tabular-nums lining-nums` so financial and capacity tables align and read effortlessly, paired with subtle `Fraunces Variable` editorial headers.
- **Dynamic, tactile manipulation**: Resizable workspace panes, window-aware Gantt scaling, and responsive drag-and-drop overlays that follow the cursor when assigning people or scheduling on-deck projects.

## Evidence on Hand
- Original 2011 product specification and page-flow blueprint (`media_1792193810741_9cf1eef7.docx`) establishing the core supply/demand model, dual-mode project assignments (fixed total hours vs. hours/day or % capacity that scales with project duration), and hybrid project costing (fixed lump-sum vs. calculated from hourly rates + non-labor costs).
- Competitive resource management market analysis informing four high-leverage capabilities: What-If Scenario Diff Drawer + Baseline Ghost Bars, Team & Role Utilization Heatmap, Financial CapEx/OpEx & Confirmed/Tentative stacking, and Smart Staffing suggestions + `TBD` hiring placeholders.

## Product Principles
- **Precision over decoration**: Every screen is boardroom-ready by default; numbers, schedules, and scenario deltas take priority over chrome, visual noise, or AI design tropes.
- **Tactile clarity**: Dragging a project bar, resizing a timeline, or assigning a person should provide immediate, visible physical feedback and deterministic recalculation of capacity and budget.
- **Data ownership and longevity**: A user's `.rdeck` file belongs to them forever—human-inspectable, AI-queryable, and safe across software upgrades.
