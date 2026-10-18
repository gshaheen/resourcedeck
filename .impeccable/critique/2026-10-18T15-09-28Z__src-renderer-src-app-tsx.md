---
target: src/renderer/src/App.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/georgeshaheen/Desktop/repos/resourcedeck/src/renderer/src/App.tsx"
target_fingerprint: "sha256:2aaf3c6a9530720d97ef14d115e7b621f1397594d9c63d5903e36d5ae970bfcd"
target_path: /Users/georgeshaheen/Desktop/repos/resourcedeck/src/renderer/src/App.tsx
timestamp: 2026-10-18T15-09-28Z
slug: src-renderer-src-app-tsx
closed: true
---
Method: dual-agent (A: 02599b26-fe8d-4f29-befa-aee3c0b3e4cd · B: d97f9da8-0875-40de-9387-daa87aebd4d9)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | `resize-end` on Gantt bars doesn't preview width live during drag (`GanttTimeline.tsx:1247`); PNG slide export has no progress/completion feedback (`App.tsx:182`) |
| 2 | Match System / Real World | 4 | Native PMO/engineering domain concepts (CapEx/OpEx, Confirmed/Tentative, TBD hires, weekday proration, 3 allocation modes) |
| 3 | User Control and Freedom | 3 | Global `Cmd+Z`/`Cmd+Shift+Z` works well, but modals/popovers lack `Escape` key and backdrop-click dismissal (`ModalsContainer.tsx:54`, `GanttTimeline.tsx:577`) |
| 4 | Consistency and Standards | 2 | Core workspace uses sharp `rounded`/`rounded-xs` hairlines, while `UtilizationHeatmap.tsx`, `ScenarioDiffDrawer.tsx`, and `ModalsContainer.tsx` drift into `rounded-2xl` cards, `<Sparkles>` icons, and hardcoded Tailwind palette colors; `TopBar` view switcher mixes radio selection with a stateful toggle |
| 5 | Error Prevention | 1 | Five destructive or baseline-overwriting actions (`Promote to Official Baseline`, `Discard Scenario`, `Reset Sample Plan`, `deleteProject`, `deletePerson`) fire on a single click with zero confirmation; `SetBudgetsModal` silently overwrites CapEx/OpEx splits with `0.7`/`0.3` (`ModalsContainer.tsx:147`) |
| 6 | Recognition Rather Than Recall | 3 | Ghost bars and `DragOverlay` are strong, but `ChartsPanel` titles & `ExecutiveKpiBar` don't show active Person/Role/Dept filter scope; project color only appears on 6px bar edges |
| 7 | Flexibility and Efficiency | 3 | CSV/Excel bulk paste, 12-month budget fill, and 1-click Clash auto-shift are fast; lacks keyboard shortcuts for views/drawers and keyboard arrow nudging on focused Gantt bars |
| 8 | Aesthetic and Minimalist Design | 3 | Clean paper/ink foundation and tabular numerals, but `TopBar.tsx` packs 10+ controls into one bar and `LeftSidebar.tsx:525` hardcodes `person-adam` expanded on load |
| 9 | Error Recovery | 3 | Actionable red `Clash` pill on Gantt bars and explicit overrun deltas (`+42h`, `+$12,500`), but CSV paste silently coerces invalid dates/costs and PNG export errors fail silently |
| 10 | Help and Documentation | 2 | Good inline empty states, but no shortcut legend, no explanation of how allocation modes interact with PTO/holidays, and `ROI Score` (`GanttTimeline.tsx:997`) is never surfaced outside the inspector |
| **Total** | | **27/40** | **Acceptable (1 point shy of Good — solid architectural foundation held back by unguarded destructive actions and component style drift)** |

### Design Specificity Verdict

**LLM assessment**: `resourcedeck`'s tri-pane workbench (`LeftSidebar` staging deck + roster, `GanttTimeline` with baseline ghost bars and dependency clash pills, and synchronized dual `ChartsPanel` rollups) is unmistakably purpose-built for portfolio supply-vs.-demand modeling. Pairing `Fraunces Variable` headers with `Plus Jakarta Sans Variable` (`tabular-nums lining-nums`) over the crisp `boardroom-daylight` paper/ink surface gives the primary workspace genuine architectural authority. However, three fractures undermine its specificity:
1. **Invisible Microcosm Block Mark (`■`)**: `PRODUCT.md` establishes the single flat square block (`■`) as the core microcosm mark of `resourcedeck`, yet `TopBar.tsx:91` sets `backgroundColor: 'var(--brand-primary)'`—a CSS variable that is never defined in `themes.css` (which uses `--accent-primary` and `--text-primary`). As a result, the square block mark renders transparent/invisible! Moreover, project color swatches (`LeftSidebar.tsx:64`, `App.tsx:332`) use `rounded-xs` instead of crisp `rounded-none` flat squares.
2. **Component Trope & Radius Drift**: While `TopBar`, `LeftSidebar`, `GanttTimeline`, and `ExecutiveKpiBar` use architectural 2px–4px radii and semantic CSS tokens, `UtilizationHeatmap.tsx` (`rounded-2xl`, `rounded-lg`, `accent-indigo-500`), `ScenarioDiffDrawer.tsx` (`rounded-xl`, `text-rose-400`, `<Sparkles>`), and `ModalsContainer.tsx` (`rounded-2xl`, `<Sparkles className="text-amber-400">`) revert to puffy consumer SaaS radii and AI sparkle tropes explicitly prohibited by `PRODUCT.md`.
3. **Vertical Compression in Split Presentation Mode**: Pressing `Present` (`Cmd+P`) while in `split-timeline` view inserts the tall `ExecutiveKpiBar` above `GanttTimeline` and both stacked charts in `ChartsPanel`, compressing the two Recharts graphs into cramped vertical slivers on laptop screens.

**Deterministic scan (`impeccable detect --json src/renderer/src`)**:
- Scanned 13 `.tsx`/`.ts`/`.css` files in `src/renderer/src`; returned **0 regex rule violations and 0 advisories** (exit code `0`).
- **Agreement & Coverage Nuance**: The static detector confirmed zero banned font families, zero bounce-easing anti-patterns, and zero copy slop rules. However, because `impeccable detect` runs in static regex mode on `.tsx`/`.css` source files, it could not evaluate computed DOM styles—missing the undefined `var(--brand-primary)` token in `TopBar.tsx:91`, the `<Sparkles>` icon usage in `ScenarioDiffDrawer.tsx:302` and `ModalsContainer.tsx:1078`, and the 16×16px (`w-4 h-4`) action targets on Gantt bars (`GanttTimeline.tsx:1284, 1295`) that Assessment A caught.

**Visual overlays**: No reliable user-visible browser overlay is available in this environment (fallback signal: mutable browser automation / DOM `<script>` tag injection for `detect.js` is not exposed in the current tool surface).

### Overall Impression

`resourcedeck` already nails the hardest part of portfolio software: the tactile connection between dragging a project bar, seeing the baseline ghost bar trail behind, and watching capacity and financial overruns recalculate instantaneously. The single biggest opportunity is **unifying the entire interface around the sharp, architectural flat-block grammar (`■`)** while adding essential guardrails around destructive/baseline actions and giving Presentation Mode breathing room when the timeline and charts share the screen.

### What's Working

1. **Synchronized Baseline Ghost Bars & Dashed Chart Reference Lines (`GanttTimeline.tsx:353-363, 1225-1239` & `ChartsPanel.tsx:331-341, 516-527`)**: Rendering the locked baseline schedule as a dashed ghost bar directly behind the active project bar while plotting `baselineDemandHours` and `baselineCost` on the stacked charts eliminates tab-switching and makes What-If trade-offs legible in seconds.
2. **Root-Level `@dnd-kit` DragOverlay Across Scroll Containers (`App.tsx:298-347`)**: Floating cursor-attached preview cards for dragged People and On-Deck Projects bridge the `overflow-y-auto` sidebar and `overflow-auto` Gantt grid without clipping, paired with clear green drop-target highlighting (`isPersonOverBar` in `GanttTimeline.tsx:1253`).
3. **Inline Dependency Clash Detection & 1-Click Auto-Shift (`GanttTimeline.tsx:378-384, 426-432, 1326-1338`)**: Highlighting schedule collisions directly on the offending Gantt bar with an actionable red `Clash` pill that shifts the project by the exact required business days is fast, contextual, and unintrusive.

### Priority Issues

#### 1. [P0] Broken Brand Mark Token (`--brand-primary`) & Residual AI/Consumer SaaS Tropes (`<Sparkles>`, `rounded-2xl`, Hardcoded Colors)
- **What**: `TopBar.tsx:91` styles the signature flat square block (`■`) with `backgroundColor: 'var(--brand-primary)'`, which does not exist in `themes.css`, making the brand mark invisible. Meanwhile, `ScenarioDiffDrawer.tsx:302` and `ModalsContainer.tsx:1078` render `<Sparkles>` icons (explicitly banned in `PRODUCT.md`), and `UtilizationHeatmap.tsx`, `ScenarioDiffDrawer.tsx`, and `ModalsContainer.tsx` use puffy `rounded-2xl`/`rounded-xl` corners and hardcoded Tailwind colors (`text-rose-400`, `text-emerald-500`, `accent-indigo-500`).
- **Why it matters**: It directly contradicts `PRODUCT.md`'s first two Brand Commitments (*"single square flat block (`■`)"* and *"zero AI-style design tropes / no decorative sparkles"*) and makes the drawer, modals, and heatmap feel stitched in from a different product.
- **Fix**: Define `--brand-primary: var(--accent-primary)` (or use `var(--text-primary)` / `var(--accent-primary)`) in `themes.css` and `TopBar.tsx:91`; make all project color swatches and status dots crisp flat squares (`rounded-none`); replace `<Sparkles>` with architectural icons (`<CheckCircle2>`, `<Database>`); and standardize radii to `rounded-md` / `rounded` with semantic CSS variables across `UtilizationHeatmap.tsx`, `ScenarioDiffDrawer.tsx`, and `ModalsContainer.tsx`.
- **Suggested command**: `/impeccable polish`

#### 2. [P1] Unguarded Destructive & Baseline-Overwriting Actions + Silent CapEx/OpEx Split Overwrite
- **What**: Five high-stakes actions execute immediately on a single click with zero confirmation: `Promote to Official Baseline` (`ScenarioDiffDrawer.tsx:297`), `Discard Scenario` (`ScenarioDiffDrawer.tsx:289`), `Reset Sample Plan` (`TopBar.tsx:183`), `deleteProject` (`LeftSidebar.tsx:98`), and `deletePerson` (`LeftSidebar.tsx:358`). Additionally, saving in `SetBudgetsModal` (`ModalsContainer.tsx:147-148`) overwrites every month's `capexBudget` and `opexBudget` with hardcoded `0.7` / `0.3` multipliers.
- **Why it matters**: During a live executive review or planning session, an accidental click can overwrite the official baseline or discard a scenario branch with no guardrail, and editing monthly budgets silently destroys custom CapEx/OpEx splits.
- **Fix**: Add inline two-step confirmation ("Confirm Promote?" / "Confirm Discard?" / "Confirm Reset?") on baseline promotion, scenario deletion, and sample reset; add confirmation or an Undo banner for project/person deletion; and preserve each month's existing CapEx/OpEx ratio in `SetBudgetsModal`.
- **Suggested command**: `/impeccable harden`

#### 3. [P1] Split Presentation Mode Vertical Compression, Missing Filter Context on Charts, & Gantt Right-Edge Resize Preview
- **What**: In `split-timeline` view, enabling `Presentation Mode` (`App.tsx:266`) stacks `ExecutiveKpiBar` + `GanttTimeline` + `ChartsPanel` (2 stacked charts), leaving `<90px` per chart on laptop screens. Additionally, when `chartFilter` is scoped to a single Person, Role, or Department (`ChartsPanel.tsx:81`), neither the chart titles nor `ExecutiveKpiBar` indicate that the numbers are filtered, and dragging the right edge of a Gantt bar (`resize-end` in `GanttTimeline.tsx:1247`) does not preview the width change until mouse-up.
- **Why it matters**: On a Zoom screen-share, crushed charts are unreadable, unlabeled filters cause executives to misread a single role's capacity as the entire company's capacity, and right-edge bar stretching lacks the tactile feedback of bar moving.
- **Fix**: Render a compact single-row KPI strip when `isPresentationMode && viewMode === 'split-timeline'`; display an explicit active-filter pill (`Scoped to: {filterLabel} ×`) in `ChartsPanel` headers and `ExecutiveKpiBar`; and apply live width preview (`width: Math.max(28, widthPx + dragOffsetPx)`) when `dragMode === 'resize-end'` in `GanttTimeline.tsx:1248`.
- **Suggested command**: `/impeccable layout`

#### 4. [P2] Confusing Tri-State View Switcher (`Charts | Timeline | Heatmap`) & Cluttered Sidebar/Inspector Defaults
- **What**: `TopBar.tsx:316-367` styles `Charts`, `Timeline` (`Open Timeline`), and `Heatmap` as a 3-way segmented control, but the middle button is a stateful toggle (`toggleTimelineOpen()`) whose label changes width dynamically, duplicated by a second `Open Timeline` button in `ChartsPanel.tsx:198`. Meanwhile, `LeftSidebar.tsx:525` hardcodes `'person-adam': true` so the first person card always loads expanded, and the Project Inspector (`GanttTimeline.tsx:576-1158`) exposes 12+ simultaneous inputs (`ROI Score` among them, which is never shown anywhere else).
- **Why it matters**: Users cannot predict whether clicking `Timeline` switches to a Timeline-only view or toggles a split pane, and cognitive load is elevated by 5+ decision points exceeding 4 visible options.
- **Fix**: Make the View Switcher a strict 3-mode selector (`Split` | `Charts` | `Heatmap`), remove the duplicate `Open Timeline` button in `ChartsPanel.tsx`, start `expandedPersonIds` collapsed (`{}`), surface `ROI Score` as a compact badge when set, and group the 7 themes in `TopBar.tsx` into Light / Dark / Projector sections.
- **Suggested command**: `/impeccable clarify`

#### 5. [P2] Keyboard Navigation, Focus Visibility & Hit-Target Deficits
- **What**: Modals (`ModalsContainer.tsx:48`) and popovers (`GanttTimeline.tsx:442, 576`) cannot be closed with `Escape` or backdrop click; `TopBar` dropdowns (`TopBar.tsx:137, 411, 459`) close on `onMouseLeave` instead of click-outside/`Escape`; hover-only actions (`opacity-0 group-hover:opacity-100` in `LeftSidebar.tsx:88, 261` and `GanttTimeline.tsx:1278`) lack `focus-within:opacity-100`; and Gantt bar action buttons (`16×16px`) and icon-only buttons lack `aria-label`s.
- **Why it matters**: Power users and keyboard/screen-reader users cannot dismiss dialogs with `Escape`, accidentally lose dropdown menus when moving the cursor diagonally, and cannot reach hover-hidden project/person actions via keyboard tabbing.
- **Fix**: Add a unified `Escape` + backdrop-click dismissal hook across all modals, popovers, and dropdowns; replace `onMouseLeave` menu closing with outside-click listeners; add `focus-within:opacity-100` and `aria-label`s to all icon buttons; and enlarge Gantt bar action hit targets.
- **Suggested command**: `/impeccable audit`

### Persona Red Flags

**Alex (Impatient Power User)**: Presses `Escape` to close the Project Inspector (`GanttTimeline.tsx:576`) or AI Data Bridge (`ModalsContainer.tsx:1066`)—nothing happens. Moves cursor diagonally from the `File` or `Export` button in `TopBar.tsx:137, 411` and `onMouseLeave` abruptly closes the menu. Drags the right edge of a Gantt bar (`resize-end`) and sees no visual width change until releasing the mouse.

**Sam (Accessibility-Dependent User)**: Tabs through `LeftSidebar.tsx:88, 261` and `GanttTimeline.tsx:1278`—all secondary actions (`Place on Timeline`, `Delete`, `edit`, `+`, `×`) remain invisible (`opacity-0`) because `focus-within:opacity-100` is missing. Encounters `16×16px` (`w-4 h-4`) buttons on Gantt bars and unlabeled icon buttons (`Undo`, `Redo`, modal `X`, row trash icons).

**Elena (VP of Engineering / PMO Leader on Live Zoom)**: Hits `Present` (`Cmd+P`) while in `split-timeline` view (`App.tsx:266`) and watches both financial and capacity charts get squished by the tall `ExecutiveKpiBar`. Filters `ChartsPanel` to a single role during Q&A, then forgets the filter is active when answering a CFO question because neither the chart titles nor `ExecutiveKpiBar` display a prominent active-filter badge. Risks accidentally clicking unguarded `Promote to Official Baseline` (`ScenarioDiffDrawer.tsx:297`) live in front of stakeholders.

### Minor Observations

- **Silent PNG Slide Export (`App.tsx:182-196`)**: `handleExportExecutiveSlide` shows no capturing indicator or success/error notification, and captures the left sidebar if not in Presentation Mode.
- **Hardcoded 2026 Default Dates (`LeftSidebar.tsx:145-146`, `ModalsContainer.tsx:298-299, 998`)**: Default PTO and new-item dates are hardcoded to mid-2026 instead of deriving from the active scenario's horizon start month.
- **Hidden `ROI Score` Value (`GanttTimeline.tsx:997-1018`)**: Users can edit a project's 1–100 `ROI Score` in the inspector, but that score never appears on the project bar, sidebar card, or diff drawer.
- **Milestone Label Collisions (`GanttTimeline.tsx:1378-1399`)**: `◆ {ms.name}` pills sit at `absolute -top-1` and can overlap the bar title or adjacent milestones when dates are close together.

### Questions to Consider

- What if the single flat square block (`■`) became the strict geometric rule for every project chip, legend swatch, status dot, and heatmap cell (`0px` radius), making the entire interface feel like arranging physical capacity blocks on an architectural board?
- When `Presentation Mode` is active in `split-timeline` view, should `ExecutiveKpiBar` automatically condense into a single-line architectural ticker strip so the Gantt timeline and dual charts keep maximum vertical legibility?
- Should `Promote to Official Baseline` feel like a deliberate, high-confidence ceremony—showing a confirmation summary of the net spend/hours delta before locking the new baseline?
