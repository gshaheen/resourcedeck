---
target: src/renderer/src/App.tsx
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/georgeshaheen/Desktop/repos/resourcedeck/src/renderer/src/App.tsx"
target_fingerprint: "sha256:c80a5d9ede00bc3d1ecdf251e4a2c831792672b9db8a45d3e7789f6a0771b710"
target_path: /Users/georgeshaheen/Desktop/repos/resourcedeck/src/renderer/src/App.tsx
timestamp: 2026-10-18T18-18-23Z
slug: src-renderer-src-app-tsx
---
Method: dual-agent (A: f94d2cd0-11b5-4675-9ea2-4c4caff15efc · B: 62547f2f-de99-4f24-920a-9e7c17fd3d49)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live WAL save indicator square, live business-day delta pill (`+3d` / `-2d`) on Gantt drag, scoped filter pills, and export toast. |
| 2 | Match System / Real World | 4 | Speaks PMO/engineering leadership vernacular fluently ("On Deck", "Baseline Ghost", "Tentative Pipeline", "Working Weekdays") with holiday-aware math. |
| 3 | User Control and Freedom | 3 | Full `Cmd+Z` / `Cmd+Shift+Z` undo/redo and `Escape` dismissal everywhere, but Gantt vertical row order is strictly locked by auto-sorting with no manual row priority override. |
| 4 | Consistency and Standards | 3 | Cohesive 6-theme token system, but `ChartsPanel.tsx` renders duplicate Cost Legend toggles, and `ManageAllPeopleModal` uses `--accent-secondary` for primary buttons where all other modals use `--accent-primary`. |
| 5 | Error Prevention | 3 | Two-step inline confirmations on destructive actions, but `ProjectDetailsModal` and `ManageAllProjectsModal` allow setting `startDate > endDate` without auto-clamping. |
| 6 | Recognition Rather Than Recall | 4 | Standardized viewport-clamped portal hover cards across Gantt bars (380px), Clash badges (380px), Heatmap squares (310px), and Charts (310px). |
| 7 | Flexibility and Efficiency | 4 | Multi-select card-deck drag-and-drop with 1-click batch assignment, CSV/Excel bulk paste, 1-click 12-month budget fill, and `Cmd+1/2/3` / `Cmd+P` shortcuts. |
| 8 | Aesthetic and Minimalist Design | 3 | Crisp 1px hairlines and clean progressive disclosure on Gantt bars and Heatmap squares, but `ManageAllProjectsModal` and `ManageAllPeopleModal` render 80–100+ heavy boxed inputs simultaneously. |
| 9 | Error Recovery | 3 | Instant 1-click "Shift After Prerequisite" button inside Clash and Project hover panels, though `onAutoResolveClash` uses a `5/7` approximation that can undershoot by 1 day on holidays/weekends. |
| 10 | Help and Documentation | 3 | Helpful empty states, micro-instructions, and self-documenting SQLite AI bridge, but keyboard shortcuts (`Cmd+1/2/3`, arrow-key bar nudging) lack tooltips or a shortcut cheat-sheet. |
| **Total** | | **34/40** | **Good (Solid foundation, high-craft polish opportunities)** |

---

### Design Specificity Verdict

**LLM assessment**: Strongly grounded in `resourcedeck`'s domain with unmistakable product character. An unrelated SaaS dashboard could not use this interface unchanged:
- **The "Microcosm Flat Square Block" (`■`) Motif**: Carried through from the `w-2.5 h-2.5` flat square brand mark in `TopBar.tsx`, to un-rounded (`rounded-none`) checkboxes, square project swatches, `■` milestone markers, and the pure `w-8 h-8` color-spectrum squares in `UtilizationHeatmap.tsx` that strip interior text in favor of a tactile block matrix.
- **Physical "Deck" Interaction**: Multi-select drag-and-drop (`App.tsx:368–419`) cascades up to 5 selected resource cards (`top: idx * 7px`, `left: idx * 7px`) with a `"N Cards"` count badge to the bottom-right of the cursor, turning the literal name `resourcedeck` into a physical metaphor.
- **Architectural Typography**: Pairing `Fraunces Variable` (`.font-editorial`) with `Plus Jakarta Sans Variable` (`tabular-nums lining-nums`) gives financial and capacity figures an authoritative editorial ledger feel.
- **Where Specificity Slips**: Inside the new full-screen bulk table views (`ManageAllProjectsModal` and `ManageAllPeopleModal` in `ModalsContainer.tsx`), every cell renders a boxed `<input>` or `<select>` with `--bg-elevated` fills and `--border-strong` outlines at rest, feeling like a traditional CRUD form grid rather than a calm architectural ledger.

**Deterministic scan**: `impeccable detect --json src/renderer/src` returned **0 primary findings** and **0 advisory findings** (`[]`, exit code `0`) across all 13 scanned `.css`, `.ts`, and `.tsx` files (verified both with and without config). Note: because the renderer consists of React `.tsx` source files rather than pre-rendered static HTML, the CLI ran regex pattern matching only; DOM-computed checks were evaluated manually in Assessment A.

**Visual overlays**: No reliable user-visible browser overlay is available in this environment (Fallback Signal: mutable browser automation / DOM `<script>` injection is not exposed in this agent harness, and the renderer relies on the Electron IPC preload bridge).

---

### Overall Impression

`resourcedeck` has matured into a cohesive, tactile, and boardroom-ready portfolio planner—the adjacent dependency routing on the Gantt canvas, standardized viewport-clamped hover cards, and multi-select card-deck drag-and-drop feel genuinely bespoke. The single biggest opportunity now is **harden-and-quiet**: fixing the `5/7` business-day math approximation in `onAutoResolveClash`, decoupling Clash inspection from accidental 1-click schedule mutation, and quieting the visual border noise in the "Edit All" bulk table modals.

---

### What's Working

1. **Adjacent Dependency Ordering + Orthogonal Gap Routing (`src/renderer/src/components/GanttTimeline.tsx:33–106, 481–563`)**: `orderTimelineProjectsWithAdjacentDependencies` deterministically places prerequisite and successor projects onto adjacent rows while keeping them on separate lines, and the SVG layer routes stepped orthogonal connectors along the inter-row boundary (`midY = (y1 + y2) / 2`) with square origin nodes and arrowheads—eliminating "spaghetti arrows" across the canvas.
2. **Standardized, Viewport-Clamped Portal Hover Cards (`GanttTimeline.tsx:1061–1117`, `ChartsPanel.tsx:654–676`, `UtilizationHeatmap.tsx:596–621`)**: Every analytical surface portals its disclosure card to `document.body` at `zIndex: 10000` with `useLayoutEffect` viewport clamping. Whether inspecting a short 1-week Gantt bar (`380px` fixed layout), a dependency clash (`380px`), a heatmap square (`310px`), or a monthly chart bar (`310px`), popovers never clip off-screen or wrap dates onto multiple lines.
3. **Dual-Mode Budget vs. Cost Breakdown (`src/renderer/src/components/ChartsPanel.tsx:69–102, 575–620`)**: Switching between `Confirmed vs. Tentative` and `By Project` (using each project's exact Gantt color while preserving bar colors above the red stepped Budget Target line) lets leaders pivot seamlessly between pipeline commitment analysis and project-level cost attribution.

---

### Priority Issues

1. **[P1] What**: `onAutoResolveClash` uses a `5/7` calendar-to-business-day approximation that can fail to clear the clash on the first click (`src/renderer/src/components/GanttTimeline.tsx:653–659`)
   - **Why it matters**: Clicking **"Shift After Prerequisite"** computes `bizShift = Math.max(1, Math.ceil((diffCal + 1) * (5 / 7)))` instead of counting actual working weekdays (and company holidays) between `project.startDate` and `pred.endDate`. Depending on weekend alignment or holidays, shifting by `bizShift` can leave `project.startDate <= pred.endDate`, leaving the red `Clash` badge unresolved after the user clicks to fix it.
   - **Fix**: Calculate the exact working-day shift needed so the project's new `startDate` lands on the first working weekday strictly after `max(pred.endDate)` across all clashing prerequisites (accounting for `holidays`).
   - **Suggested command**: `/impeccable harden`

2. **[P1] What**: Heatmap utilization squares lack keyboard focus triggers, and clicking a Gantt `Clash` badge immediately mutates project dates (`src/renderer/src/components/UtilizationHeatmap.tsx:541–562` & `src/renderer/src/components/GanttTimeline.tsx:1241–1266`)
   - **Why it matters**:
     - Because numerical text was removed from inside the `w-8 h-8` heatmap squares in favor of the hover info panel, keyboard-only users cannot inspect monthly project allocations because the squares only bind `onMouseEnter`/`onMouseLeave` (no `tabIndex={0}` or `onFocus`/`onBlur`). Additionally, over-allocated squares (`>100%`) rely solely on red hue with no secondary structural cue for colorblind users.
     - On the Gantt timeline, clicking the `Clash` badge directly triggers `onAutoResolveClash(project.id)`. A leader clicking the badge on a trackpad expecting to pin/inspect the clash details will accidentally shift the project schedule immediately.
   - **Fix**: Add `tabIndex={0}`, `onFocus`, and `onBlur` to the `w-8 h-8` squares in `UtilizationHeatmap.tsx` plus a subtle inner structural indicator on `>100%` overrun cells. Change clicking the Gantt `Clash` badge to open/pin the Clash Info Panel, keeping the schedule mutation exclusively on the explicit **"Shift After Prerequisite"** action button inside the panel.
   - **Suggested command**: `/impeccable audit`

3. **[P2] What**: High visual border noise and missing date-order clamping in `ManageAllProjectsModal` and `ManageAllPeopleModal` (`src/renderer/src/components/ModalsContainer.tsx:1184–1411, 1572–1855`)
   - **Why it matters**: Rendering 8–9 boxed `<input>`/`<select>` elements per row with permanent `--bg-elevated` backgrounds and `--border-strong` borders creates 100+ competing rectangles in the bulk edit views. In addition, editing `startDate` to a date after `endDate` in `ManageAllProjectsModal` (or `ProjectDetailsModal`) does not auto-clamp `endDate >= startDate`, and `ManageAllPeopleModal` uses `--accent-secondary` instead of `--accent-primary` for its primary action buttons.
   - **Fix**: Style bulk-table inputs as calm ledger cells (transparent borders at rest, subtle hover fill, crisp `--accent-primary` border on focus), enforce `endDate >= startDate` clamping on date edits, and align `ManageAllPeopleModal` primary buttons to `--accent-primary`.
   - **Suggested command**: `/impeccable quieter`

4. **[P2] What**: Redundant Cost Legend toggles in `ChartsPanel.tsx` and verbose dual-dollar strings in `ExecutiveKpiBar.tsx` (`src/renderer/src/components/ChartsPanel.tsx:212–256, 458–476` & `src/renderer/src/components/ExecutiveKpiBar.tsx:81–82, 218–221`)
   - **Why it matters**: `ChartsPanel.tsx` displays two separate controls right above each other that toggle the exact same `financialBreakdown` state (`Cost Legend: Confirmed vs. Tentative | By Project` in the toolbar AND `Color: Confirmed / Tentative ⇄` in the chart header). Meanwhile, `ExecutiveKpiBar.tsx` and `LeftSidebar.tsx` print both full and compact dollar figures side-by-side (`$125,000 ($125K)`), creating a 55-character string in Presentation Mode that forces horizontal scrolling on smaller laptops.
   - **Fix**: Keep the clean segmented Cost Legend control and remove the duplicate inline toggle button in `ChartsPanel.tsx`. In `ExecutiveKpiBar.tsx` and `LeftSidebar.tsx`, only append the compact parenthetical `(e.g. $1.4M)` when the value is `>= $1,000,000` (or surface the Secondary format on tooltip/sub-label) so numbers stay scannable at a glance.
   - **Suggested command**: `/impeccable distill`

5. **[P3] What**: Missing consequence counts when Deleting Projects/People or Promoting a What-If Scenario (`src/renderer/src/components/ScenarioDiffDrawer.tsx:321–355` & `src/renderer/src/components/LeftSidebar.tsx:149–169, 461–489`)
   - **Why it matters**: Promoting a What-If scenario asks `"Make [Name] the new Official Baseline?"` without reassuring the user what happens to the existing baseline. Deleting a project or person asks `"Confirm"` without warning how many active resource assignments or dependencies will be removed.
   - **Fix**: Clarify the promotion confirmation copy in `ScenarioDiffDrawer.tsx` and display affected assignment counts in the delete confirmation state. Also add keyboard shortcut hints (`Cmd+1`, `Cmd+2`, `Cmd+3`) to the `TopBar.tsx` view switcher tooltips.
   - **Suggested command**: `/impeccable clarify`

---

### Persona Red Flags

- **Alex (Impatient Power User)**:
  - **Locked Gantt row ordering (`GanttTimeline.tsx:33–106`)**: Cannot manually drag or pin a high-priority project to the top of the timeline because rows are strictly ordered by start date + dependency chains.
  - **Undiscovered keyboard shortcuts (`TopBar.tsx:434–483`, `GanttTimeline.tsx:1203–1209`)**: `Cmd+1/2/3` view switching and `ArrowLeft`/`ArrowRight` 1-day Gantt bar nudging work in code, but have no `title` tooltips on the view tabs or shortcut cheat-sheet in the UI.

- **Sam (Accessibility-Dependent User)**:
  - **Keyboard-inaccessible Heatmap popover (`UtilizationHeatmap.tsx:541–562`)**: Sighted keyboard users cannot tab onto the `w-8 h-8` utilization squares to trigger `HeatmapCellHoverPanel`.
  - **Hue-only overrun distinction on Heatmap (`UtilizationHeatmap.tsx:28–70`)**: With text removed from the `w-8 h-8` squares, `>100%` over-allocated squares are distinguished from `75%` optimal squares solely by red vs. green fill color.

- **Elena (VP of Engineering / PMO Leader Presenting Live on Zoom)**:
  - **Hair-trigger `Clash` badge click (`GanttTimeline.tsx:1251–1254`)**: Clicking a `Clash` badge during a live screen-share immediately shifts the project's schedule instead of pinning the Clash Info Panel for discussion.
  - **Crowded Presentation KPI Ribbon (`ExecutiveKpiBar.tsx:81–82`)**: Printing `$1,240,000 ($1.2M) / $1,500,000 ($1.5M) ($260,000 under)` in a single inline span causes horizontal overflow on 13–14" laptop viewports.

---

### Minor Observations

- **View switcher tabs lack shortcut tooltips (`TopBar.tsx:434–483`)**: Adding `title="Split View (⌘1)"`, `title="Charts View (⌘2)"`, and `title="Heatmap View (⌘3)"` makes existing shortcuts immediately discoverable.
- **Overflowing project names on short bars near the right horizon edge (`GanttTimeline.tsx:1214–1228`)**: Because project names never truncate (`whitespace-nowrap` + `overflow-visible`), a short project scheduled in the final month of the horizon extends its text label to the right of the bar; flipping the label alignment when a short bar sits near the right edge (`leftPercent > 82%`) will prevent horizontal canvas overflow.
- **Milestone custom colors (`ModalsContainer.tsx:682`, `GanttTimeline.tsx:1709–1718`)**: Milestones store a `color` field in SQLite (`#0f766e`), but the timeline milestone marker ignores `ms.color`.

---

### Questions to Consider

- **When a leader clicks a `Clash` badge on the Gantt bar, are they asking *"Why is this clashing?"* or *"Move it right now"*?** Separating *inspection* (badge click pins/focuses the Clash Info Panel) from *mutation* (clicking "Shift After Prerequisite" inside the panel) would make live presentations much safer.
- **How can the Heatmap's `>100%` Overrun squares use the flat square block (`■`) motif for accessibility?** Adding a crisp inner square dot (`w-1.5 h-1.5`) or top-right corner mark inside `>100%` cells would let colorblind users and back-of-room executives spot bottlenecks before hovering.
- **Should the "Edit All" modals feel like a web form or an architectural ledger?** Making cell borders quiet until hovered or focused would transform 100 boxed inputs into a calm, high-density spreadsheet.
