import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import { calculateScenarioMonthlyRollup } from '../../../shared/engine/calculator'
import {
  formatDollarCompact,
  formatDollarWhole
} from '../../../shared/engine/formatters'
import type { MonthlyRollup, Project } from '../../../shared/types'

export type HoveredBudgetSegment =
  | { kind: 'project'; projectId: string }
  | { kind: 'confirmed' }
  | { kind: 'tentative' }
  | null

export const ChartsPanel: React.FC = () => {
  const {
    dataset,
    baselineDataset,
    viewMode,
    isChartsMinimized,
    setChartsMinimized,
    chartFilter,
    setChartFilter
  } = useDeckStore()

  // Store pointer coordinates in a ref so moving the mouse across the charts
  // never triggers full Recharts SVG tree re-renders on every pixel.
  const pointerPosRef = useRef<{ x: number; y: number }>({
    x: 400,
    y: 300
  })

  // Track which specific bar segment is hovered in the Budgets vs. Costs chart
  const [hoveredBudgetSegment, setHoveredBudgetSegment] =
    useState<HoveredBudgetSegment>(null)

  const rollups = useMemo(
    () => calculateScenarioMonthlyRollup(dataset, chartFilter),
    [dataset, chartFilter]
  )

  const baselineRollups = useMemo(
    () => calculateScenarioMonthlyRollup(baselineDataset, chartFilter),
    [baselineDataset, chartFilter]
  )

  const activeFilterLabel = useMemo(() => {
    if (chartFilter.type === 'all') return null
    if (chartFilter.type === 'person') {
      const p = dataset.people.find((x) => x.id === chartFilter.value)
      return p ? `${p.name} (${p.role})` : 'Selected Person'
    }
    if (chartFilter.type === 'role') return `Role: ${chartFilter.value}`
    if (chartFilter.type === 'department') return `Dept: ${chartFilter.value}`
    return null
  }, [chartFilter, dataset.people])

  const timelineProjects = useMemo(
    () => dataset.projects.filter((p) => p.status === 'timeline'),
    [dataset.projects]
  )

  const projectMap = useMemo(
    () => new Map(dataset.projects.map((p) => [p.id, p])),
    [dataset.projects]
  )

  const projectColorMap = useMemo(
    () => new Map(dataset.projects.map((p) => [p.id, p.color])),
    [dataset.projects]
  )

  // User can switch Budget vs. Cost color coding between Confirmed vs. Tentative ('total') and By Project ('by_project')
  const breakdownMode: 'total' | 'by_project' =
    chartFilter.financialBreakdown === 'by_project' ? 'by_project' : 'total'

  const isWhatIf = !dataset.scenario.isBaseline
  const baselineByMonth = useMemo(
    () => new Map(baselineRollups.map((r) => [r.yearMonth, r])),
    [baselineRollups]
  )

  const chartData = useMemo(() => {
    return rollups.map((r) => {
      const base = baselineByMonth.get(r.yearMonth)
      const perProjectCosts: Record<string, number> = {}
      for (const tp of timelineProjects) {
        perProjectCosts[`proj_cost_${tp.id}`] = 0
      }
      for (const pb of r.projectBreakdowns) {
        perProjectCosts[`proj_cost_${pb.projectId}`] = Math.round(pb.totalCost)
      }
      return {
        ...r,
        ...perProjectCosts,
        confirmedCost: Math.round(r.confirmedCost),
        tentativeCost: Math.round(r.tentativeCost),
        totalCost: Math.round(r.totalCost),
        laborCost: Math.round(r.laborCost),
        nonLaborCost: Math.round(r.nonLaborCost),
        budgetAmount: Math.round(r.budgetAmount),
        baselineDemandHours: base?.totalDemandHours ?? r.totalDemandHours,
        baselineCost: Math.round(base?.totalCost ?? r.totalCost)
      }
    })
  }, [rollups, baselineByMonth, timelineProjects])

  const uniqueRoles = useMemo(
    () => Array.from(new Set(dataset.people.map((p) => p.role))),
    [dataset.people]
  )
  const uniqueDepartments = useMemo(
    () => Array.from(new Set(dataset.people.map((p) => p.department))),
    [dataset.people]
  )

  const capacityOverrunCount = rollups.filter((r) => r.isCapacityOverrun).length
  const budgetOverrunCount = rollups.filter((r) => r.isBudgetOverrun).length

  // Minimized Dock Bar when in Split View and user collapses charts for full-height Gantt
  if (viewMode === 'split-timeline' && isChartsMinimized) {
    return (
      <section
        className="h-9 px-3 border-t flex items-center justify-between gap-3 shrink-0 select-none"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)'
        }}
      >
        <div className="flex items-center gap-3 min-w-0 text-xs">
          <span className="font-editorial font-semibold">
            Capacity &amp; Financial Charts
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded border tabular-nums"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color:
                capacityOverrunCount > 0
                  ? 'var(--status-overrun)'
                  : 'var(--text-secondary)'
            }}
          >
            {capacityOverrunCount > 0
              ? `${capacityOverrunCount} Capacity Overrun ${capacityOverrunCount === 1 ? 'Month' : 'Months'}`
              : 'Within Capacity'}
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded border tabular-nums"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color:
                budgetOverrunCount > 0
                  ? 'var(--status-overrun)'
                  : 'var(--text-secondary)'
            }}
          >
            {budgetOverrunCount > 0
              ? `${budgetOverrunCount} Over-Budget ${budgetOverrunCount === 1 ? 'Month' : 'Months'}`
              : 'Within Budget'}
          </span>
        </div>

        <button
          onClick={() => setChartsMinimized(false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold transition-colors hover:opacity-90 shrink-0"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)'
          }}
          title="Restore Capacity & Financial Charts"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          <span>Expand Charts</span>
        </button>
      </section>
    )
  }

  return (
    <section
      onMouseMove={(e) => {
        pointerPosRef.current = { x: e.clientX, y: e.clientY }
      }}
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Filter & Controls Toolbar */}
      <div
        className="h-9 px-3 border-b flex items-center justify-between gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Person / Role / Department Selector */}
          <select
            aria-label="Filter charts by person, role, or department"
            value={`${chartFilter.type}::${chartFilter.value}`}
            onChange={(e) => {
              const [type, value] = e.target.value.split('::') as [
                typeof chartFilter.type,
                string
              ]
              setChartFilter({ type, value })
            }}
            className="px-2 py-0.5 rounded border text-xs font-medium cursor-pointer max-w-[260px]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: activeFilterLabel
                ? 'var(--accent-primary)'
                : 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="all::all">All People ({dataset.people.length})</option>
            <optgroup label="Person">
              {dataset.people.map((p) => (
                <option key={p.id} value={`person::${p.id}`}>
                  {p.name} ({p.role} · {p.hoursPerDay}h/d)
                </option>
              ))}
            </optgroup>
            <optgroup label="Role">
              {uniqueRoles.map((r) => (
                <option key={r} value={`role::${r}`}>
                  Role: {r}
                </option>
              ))}
            </optgroup>
            <optgroup label="Department">
              {uniqueDepartments.map((d) => (
                <option key={d} value={`department::${d}`}>
                  Dept: {d}
                </option>
              ))}
            </optgroup>
          </select>

          {activeFilterLabel && (
            <button
              onClick={() => setChartFilter({ type: 'all', value: 'all' })}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold shrink-0"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-primary)'
              }}
              title="Clear filter and show all people"
            >
              <span>Scoped: {activeFilterLabel}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          <label
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] cursor-pointer select-none shrink-0"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            <input
              type="checkbox"
              checked={chartFilter.includeTentative}
              onChange={(e) => setChartFilter({ includeTentative: e.target.checked })}
              className="rounded-none"
            />
            <span>Include Tentative</span>
          </label>
        </div>

        {/* Minimize Charts Button (in Split View so Gantt gets full view) */}
        {viewMode === 'split-timeline' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setChartsMinimized(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)'
              }}
              title="Minimize charts so the Gantt timeline fills the full view"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Minimize Charts</span>
            </button>
          </div>
        )}
      </div>

      {/* Dual Stacked Charts (Top = Capacity vs Demand, Bottom = Budgets vs Costs) */}
      <div className="flex-1 min-h-0 p-2.5 grid grid-rows-2 gap-2.5 overflow-hidden">
        {/* Chart 1: People/Resource Capacity vs. Demand (Hours) */}
        <div
          className="rounded border px-3 py-2 flex flex-col min-h-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div className="flex items-center justify-between mb-1 shrink-0 gap-2">
            <h3 className="font-editorial text-xs md:text-sm font-semibold">
              People / Resource Capacity vs. Demand (Hours)
              {activeFilterLabel && (
                <span
                  className="ml-2 font-sans text-[11px] font-semibold"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  — {activeFilterLabel}
                </span>
              )}
            </h3>

            <div className="flex items-center gap-3 text-[11px] tabular-nums shrink-0">
              {capacityOverrunCount > 0 ? (
                <span
                  className="font-semibold"
                  style={{ color: 'var(--status-overrun)' }}
                >
                  {capacityOverrunCount} Overrun {capacityOverrunCount === 1 ? 'Month' : 'Months'}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Within Capacity</span>
              )}

              <div className="hidden sm:flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1" title="Monthly Available Capacity Step Line">
                  <span
                    className="w-3.5 h-0.5 inline-block"
                    style={{ backgroundColor: 'var(--chart-capacity)' }}
                  />
                  Capacity (Step)
                </span>
                <span className="flex items-center gap-1" title="Confirmed Project Demand Hours">
                  <span
                    className="w-2.5 h-2.5 inline-block shrink-0"
                    style={{ backgroundColor: 'var(--chart-demand)' }}
                  />
                  Confirmed
                </span>
                {chartFilter.includeTentative && (
                  <span className="flex items-center gap-1" title="Tentative Pipeline Demand Hours">
                    <span
                      className="w-2.5 h-2.5 inline-block shrink-0"
                      style={{ backgroundColor: 'var(--chart-tentative)' }}
                    />
                    Tentative
                  </span>
                )}
                <span className="flex items-center gap-1" title="Demand Exceeds Capacity (>100% Utilization)">
                  <span
                    className="w-2.5 h-2.5 inline-block shrink-0"
                    style={{ backgroundColor: 'var(--status-overrun)' }}
                  />
                  Overrun
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 2"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val: number) => `${Math.round(val).toLocaleString()}h`}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                  content={
                    <CustomRollupTooltip
                      mode="capacity"
                      pointerPosRef={pointerPosRef}
                      includeTentative={chartFilter.includeTentative}
                      financialBreakdown={breakdownMode}
                      hoveredBudgetSegment={null}
                      projectMap={projectMap}
                      projectColorMap={projectColorMap}
                    />
                  }
                />

                <Bar
                  dataKey="confirmedDemandHours"
                  stackId="demand"
                  name="Confirmed Demand (hrs)"
                  fill="var(--chart-demand)"
                  isAnimationActive={false}
                >
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={`cell-cap-${idx}`}
                      fill={
                        entry.isCapacityOverrun
                          ? 'var(--status-overrun)'
                          : 'var(--chart-demand)'
                      }
                    />
                  ))}
                </Bar>

                {chartFilter.includeTentative && (
                  <Bar
                    dataKey="tentativeDemandHours"
                    stackId="demand"
                    name="Tentative Demand (hrs)"
                    fill="var(--chart-tentative)"
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`cell-tent-${idx}`}
                        fill={
                          entry.isCapacityOverrun
                            ? 'var(--status-overrun)'
                            : 'var(--chart-tentative)'
                        }
                        fillOpacity={0.75}
                      />
                    ))}
                  </Bar>
                )}

                {isWhatIf && (
                  <Line
                    type="step"
                    dataKey="baselineDemandHours"
                    name="Baseline Demand"
                    stroke="var(--text-muted)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                <Line
                  type="step"
                  dataKey="capacityHours"
                  name="Capacity Target (hrs)"
                  stroke="var(--chart-capacity)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: 'var(--chart-capacity)' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Budgets vs. Costs ($) — Cost Legend lives directly in this chart header */}
        <div
          className="rounded border px-3 py-2 flex flex-col min-h-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div className="flex flex-wrap items-center justify-between mb-1 shrink-0 gap-2">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h3 className="font-editorial text-xs md:text-sm font-semibold">
                Budgets vs. Costs ($)
                {activeFilterLabel && (
                  <span
                    className="ml-2 font-sans text-[11px] font-semibold"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    — {activeFilterLabel}
                  </span>
                )}
              </h3>

              {/* Cost Legend Mode Switcher placed directly by the Budgets vs. Costs chart */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[11px] hidden sm:inline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cost Legend:
                </span>
                <div
                  role="group"
                  aria-label="Budget chart bar color coding mode"
                  className="flex items-center p-0.5 rounded border text-[11px]"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  <button
                    onClick={() => {
                      setHoveredBudgetSegment(null)
                      setChartFilter({ financialBreakdown: 'total' })
                    }}
                    className="px-2 py-0.5 rounded-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        breakdownMode === 'total'
                          ? 'var(--bg-surface)'
                          : 'transparent',
                      color:
                        breakdownMode === 'total'
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)'
                    }}
                  >
                    Confirmed vs. Tentative
                  </button>
                  <button
                    onClick={() => {
                      setHoveredBudgetSegment(null)
                      setChartFilter({ financialBreakdown: 'by_project' })
                    }}
                    className="px-2 py-0.5 rounded-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        breakdownMode === 'by_project'
                          ? 'var(--bg-surface)'
                          : 'transparent',
                      color:
                        breakdownMode === 'by_project'
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)'
                    }}
                  >
                    By Project
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] tabular-nums shrink-0">
              {budgetOverrunCount > 0 ? (
                <span
                  className="font-semibold"
                  style={{ color: 'var(--status-overrun)' }}
                >
                  {budgetOverrunCount} Over-Budget {budgetOverrunCount === 1 ? 'Month' : 'Months'}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Within Budget</span>
              )}

              <div
                className="hidden sm:flex items-center gap-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="flex items-center gap-1" title="Monthly Budget Step Line">
                  <span
                    className="w-3.5 h-0.5 inline-block"
                    style={{ backgroundColor: 'var(--chart-budget)' }}
                  />
                  Budget (Step)
                </span>
                {breakdownMode === 'by_project' ? (
                  <span
                    className="flex items-center gap-1.5"
                    title="Bars are color-coded by project. Hover any bar segment for specific project & monthly budget details."
                  >
                    <span className="flex items-center gap-0.5">
                      {timelineProjects.slice(0, 4).map((tp) => (
                        <span
                          key={tp.id}
                          className="w-2 h-2 inline-block shrink-0"
                          style={{ backgroundColor: tp.color }}
                        />
                      ))}
                    </span>
                    <span>Hover segment for project details</span>
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 inline-block shrink-0"
                        style={{ backgroundColor: 'var(--chart-cost)' }}
                      />
                      Confirmed
                    </span>
                    {chartFilter.includeTentative && (
                      <span className="flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 inline-block shrink-0 opacity-75"
                          style={{ backgroundColor: 'var(--chart-tentative)' }}
                        />
                        Tentative
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
                onMouseLeave={() => setHoveredBudgetSegment(null)}
              >
                <CartesianGrid
                  strokeDasharray="2 2"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val: number) => formatDollarCompact(val)}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                  content={
                    <CustomRollupTooltip
                      mode="budget"
                      pointerPosRef={pointerPosRef}
                      includeTentative={chartFilter.includeTentative}
                      financialBreakdown={breakdownMode}
                      hoveredBudgetSegment={hoveredBudgetSegment}
                      projectMap={projectMap}
                      projectColorMap={projectColorMap}
                    />
                  }
                />

                {/* Mode 1: Confirmed vs. Tentative color coding (never turns red on budget overrun) */}
                {breakdownMode === 'total' && (
                  <Bar
                    dataKey="confirmedCost"
                    stackId="cost"
                    name="Confirmed Cost ($)"
                    fill="var(--chart-cost)"
                    isAnimationActive={false}
                    onMouseEnter={() =>
                      setHoveredBudgetSegment({ kind: 'confirmed' })
                    }
                    onMouseLeave={() => setHoveredBudgetSegment(null)}
                  />
                )}

                {breakdownMode === 'total' && chartFilter.includeTentative && (
                  <Bar
                    dataKey="tentativeCost"
                    stackId="cost"
                    name="Tentative Cost ($)"
                    fill="var(--chart-tentative)"
                    fillOpacity={0.75}
                    isAnimationActive={false}
                    onMouseEnter={() =>
                      setHoveredBudgetSegment({ kind: 'tentative' })
                    }
                    onMouseLeave={() => setHoveredBudgetSegment(null)}
                  />
                )}

                {/* Mode 2: By Project color coding (matches each project's Gantt bar color) */}
                {breakdownMode === 'by_project' &&
                  timelineProjects.map((proj: Project) => (
                    <Bar
                      key={proj.id}
                      dataKey={`proj_cost_${proj.id}`}
                      stackId="projects"
                      name={proj.name}
                      fill={proj.color}
                      isAnimationActive={false}
                      onMouseEnter={() =>
                        setHoveredBudgetSegment({
                          kind: 'project',
                          projectId: proj.id
                        })
                      }
                      onMouseLeave={() => setHoveredBudgetSegment(null)}
                    />
                  ))}

                {/* Budget Target step line is the ONLY line showing on the Budget vs. Cost chart */}
                <Line
                  type="step"
                  dataKey="budgetAmount"
                  name="Budget Target ($)"
                  stroke="var(--chart-budget)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: 'var(--chart-budget)' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: MonthlyRollup & { baselineDemandHours: number; baselineCost: number } }[]
  mode: 'capacity' | 'budget'
  pointerPosRef: React.MutableRefObject<{ x: number; y: number }>
  includeTentative: boolean
  financialBreakdown: 'total' | 'by_project'
  hoveredBudgetSegment: HoveredBudgetSegment
  projectMap: Map<string, Project>
  projectColorMap: Map<string, string>
}

const CustomRollupTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  mode,
  pointerPosRef,
  includeTentative,
  financialBreakdown,
  hoveredBudgetSegment,
  projectMap,
  projectColorMap
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const pointerPos = pointerPosRef.current
  const [clampedPos, setClampedPos] = useState<{ left: number; top: number }>({
    left: pointerPos.x + 16,
    top: pointerPos.y - 16
  })

  useLayoutEffect(() => {
    if (!active || !cardRef.current) return
    const curPointer = pointerPosRef.current
    const rect = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 12

    let left = curPointer.x + 16
    if (left + rect.width > vw - pad) {
      left = Math.max(pad, curPointer.x - rect.width - 16)
    }

    let top = curPointer.y - 16
    if (top + rect.height > vh - pad) {
      top = Math.max(pad, vh - rect.height - pad)
    }
    if (top < pad) {
      top = pad
    }

    setClampedPos({ left, top })
  }, [active, payload, hoveredBudgetSegment, pointerPosRef])

  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload

  // Compute budget delta (Total Cost vs Total Budget)
  const budgetVariance = Math.round(data.totalCost - data.budgetAmount)
  const isOverBudget = budgetVariance > 0

  // Resolve hovered segment details for Budget vs. Cost mode
  const hoveredProjectBreakdown =
    mode === 'budget' &&
    financialBreakdown === 'by_project' &&
    hoveredBudgetSegment?.kind === 'project'
      ? data.projectBreakdowns.find(
          (pb) => pb.projectId === hoveredBudgetSegment.projectId
        ) ?? null
      : null

  const hoveredProjectMeta =
    hoveredBudgetSegment?.kind === 'project'
      ? projectMap.get(hoveredBudgetSegment.projectId) ?? null
      : null

  const tooltipContent = (
    <div
      ref={cardRef}
      className="fixed rounded border p-3 shadow-2xl text-xs space-y-2.5 w-[320px] pointer-events-none"
      style={{
        left: `${clampedPos.left}px`,
        top: `${clampedPos.top}px`,
        zIndex: 9999,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'hidden',
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)'
      }}
    >
      <div
        className="flex items-center justify-between border-b pb-1.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="font-semibold text-sm">{data.label}</span>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {data.workingWeekdays} working weekdays
        </span>
      </div>

      {mode === 'capacity' ? (
        <>
          <div className="space-y-1 tabular-nums">
            {/* Capacity Target Step Line */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="w-3.5 h-0.5 inline-block shrink-0"
                  style={{ backgroundColor: 'var(--chart-capacity)' }}
                />
                Capacity Target (Step Line):
              </span>
              <span className="font-semibold">{Math.round(data.capacityHours).toLocaleString()}h</span>
            </div>

            {/* Confirmed Demand Bar */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="w-2.5 h-2.5 inline-block shrink-0"
                  style={{
                    backgroundColor: data.isCapacityOverrun
                      ? 'var(--status-overrun)'
                      : 'var(--chart-demand)'
                  }}
                />
                Confirmed Demand (Bar):
              </span>
              <span className="font-medium">
                {Math.round(data.confirmedDemandHours).toLocaleString()}h
              </span>
            </div>

            {/* Tentative Demand Bar */}
            {(includeTentative || data.tentativeDemandHours > 0) && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="w-2.5 h-2.5 inline-block shrink-0 opacity-75"
                    style={{
                      backgroundColor: data.isCapacityOverrun
                        ? 'var(--status-overrun)'
                        : 'var(--chart-tentative)'
                    }}
                  />
                  Tentative Pipeline (Bar):
                </span>
                <span className="font-medium">
                  {Math.round(data.tentativeDemandHours).toLocaleString()}h
                </span>
              </div>
            )}

            {/* Total Demand */}
            <div
              className="flex items-center justify-between gap-3 pt-1 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Total Demand:</span>
              <span className="font-semibold">
                {Math.round(data.totalDemandHours).toLocaleString()}h
              </span>
            </div>

            {/* Utilization & Overrun Status */}
            <div
              className="flex items-center justify-between gap-3 pt-1 border-t font-semibold"
              style={{
                borderColor: 'var(--border-subtle)',
                color: data.isCapacityOverrun
                  ? 'var(--status-overrun)'
                  : 'var(--status-optimal)'
              }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block shrink-0"
                  style={{
                    backgroundColor: data.isCapacityOverrun
                      ? 'var(--status-overrun)'
                      : 'var(--status-optimal)'
                  }}
                />
                {data.isCapacityOverrun ? 'Capacity Overrun:' : 'Utilization:'}
              </span>
              <span>
                {data.isCapacityOverrun
                  ? `+${Math.round(data.capacityOverrunHours).toLocaleString()}h (${data.utilizationPercent}%)`
                  : `${data.utilizationPercent}%`}
              </span>
            </div>
          </div>

          {data.projectBreakdowns.length > 0 && (
            <div
              className="pt-1.5 border-t space-y-1"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Project Demand Breakdown
              </div>
              {data.projectBreakdowns.map((pb) => {
                const pColor = projectColorMap.get(pb.projectId) || 'var(--accent-primary)'
                return (
                  <div
                    key={pb.projectId}
                    className="flex items-start justify-between gap-2 text-[11px] tabular-nums"
                  >
                    <span
                      className="flex items-start gap-1.5 break-words leading-snug"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="w-2 h-2 mt-1 shrink-0"
                        style={{ backgroundColor: pColor }}
                      />
                      <span>{pb.projectName}</span>
                    </span>
                    <span className="font-medium shrink-0">
                      {Math.round(pb.hours).toLocaleString()}h
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2.5 tabular-nums">
          {/* PART 1: Specific Hovered Bar Portion Details (Project OR Confirmed OR Tentative) */}
          <div
            className="p-2 rounded border space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {financialBreakdown === 'by_project'
                ? hoveredProjectBreakdown || hoveredProjectMeta
                  ? 'Hovered Bar Segment · Project'
                  : 'Bar Breakdown · By Project'
                : hoveredBudgetSegment?.kind === 'confirmed'
                  ? 'Hovered Bar Segment · Confirmed'
                  : hoveredBudgetSegment?.kind === 'tentative'
                    ? 'Hovered Bar Segment · Tentative'
                    : 'Bar Breakdown · Confirmed vs. Tentative'}
            </div>

            {financialBreakdown === 'by_project' ? (
              hoveredProjectBreakdown || hoveredProjectMeta ? (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-1.5 font-semibold break-words leading-snug">
                      <span
                        className="w-2.5 h-2.5 mt-0.5 shrink-0"
                        style={{
                          backgroundColor:
                            hoveredProjectMeta?.color || 'var(--accent-primary)'
                        }}
                      />
                      <span>
                        {hoveredProjectBreakdown?.projectName ||
                          hoveredProjectMeta?.name}
                      </span>
                    </span>
                    <span className="font-bold shrink-0">
                      {formatDollarWhole(hoveredProjectBreakdown?.totalCost ?? 0)}
                    </span>
                  </div>
                  {hoveredProjectBreakdown && (
                    <div
                      className="flex items-center justify-between text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span>
                        Labor {formatDollarWhole(hoveredProjectBreakdown.laborCost)} ·
                        Other {formatDollarWhole(hoveredProjectBreakdown.nonLaborCost)}
                      </span>
                      <span>
                        {data.totalCost > 0
                          ? `${Math.round((hoveredProjectBreakdown.totalCost / data.totalCost) * 100)}% of month`
                          : '0%'}
                      </span>
                    </div>
                  )}
                </div>
              ) : data.projectBreakdowns.length > 0 ? (
                <div className="space-y-1">
                  {data.projectBreakdowns.map((pb) => {
                    const pColor =
                      projectColorMap.get(pb.projectId) || 'var(--accent-primary)'
                    return (
                      <div
                        key={pb.projectId}
                        className="flex items-start justify-between gap-2 text-[11px]"
                      >
                        <span
                          className="flex items-start gap-1.5 break-words leading-snug"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <span
                            className="w-2.5 h-2.5 mt-0.5 shrink-0"
                            style={{ backgroundColor: pColor }}
                          />
                          <span>{pb.projectName}</span>
                        </span>
                        <span className="font-semibold shrink-0">
                          {formatDollarWhole(pb.totalCost)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  No active project costs in this month.
                </div>
              )
            ) : hoveredBudgetSegment?.kind === 'confirmed' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span
                      className="w-2.5 h-2.5 inline-block shrink-0"
                      style={{ backgroundColor: 'var(--chart-cost)' }}
                    />
                    Confirmed Cost:
                  </span>
                  <span className="font-bold">
                    {formatDollarWhole(data.confirmedCost)}
                  </span>
                </div>
                <div
                  className="flex items-center justify-between text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>{Math.round(data.confirmedDemandHours).toLocaleString()}h confirmed labor</span>
                  <span>
                    {data.totalCost > 0
                      ? `${Math.round((data.confirmedCost / data.totalCost) * 100)}% of month`
                      : '0%'}
                  </span>
                </div>
              </div>
            ) : hoveredBudgetSegment?.kind === 'tentative' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span
                      className="w-2.5 h-2.5 inline-block shrink-0 opacity-75"
                      style={{ backgroundColor: 'var(--chart-tentative)' }}
                    />
                    Tentative Cost:
                  </span>
                  <span className="font-bold">
                    {formatDollarWhole(data.tentativeCost)}
                  </span>
                </div>
                <div
                  className="flex items-center justify-between text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>{Math.round(data.tentativeDemandHours).toLocaleString()}h tentative labor</span>
                  <span>
                    {data.totalCost > 0
                      ? `${Math.round((data.tentativeCost / data.totalCost) * 100)}% of month`
                      : '0%'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex items-center gap-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span
                      className="w-2.5 h-2.5 inline-block shrink-0"
                      style={{ backgroundColor: 'var(--chart-cost)' }}
                    />
                    Confirmed Cost:
                  </span>
                  <span className="font-semibold">
                    {formatDollarWhole(data.confirmedCost)}
                  </span>
                </div>
                {(includeTentative || data.tentativeCost > 0) && (
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="w-2.5 h-2.5 inline-block shrink-0 opacity-75"
                        style={{ backgroundColor: 'var(--chart-tentative)' }}
                      />
                      Tentative Cost:
                    </span>
                    <span className="font-semibold">
                      {formatDollarWhole(data.tentativeCost)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PART 2: High-Level Overview of That Month's Bar — Total Cost vs Total Budget & Over/Under Budget */}
          <div className="space-y-1.5 pt-0.5">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Monthly Bar Overview
            </div>

            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--text-secondary)' }}>Total Monthly Cost:</span>
              <span className="font-semibold">
                {formatDollarWhole(data.totalCost)}
                {data.totalCost >= 10000
                  ? ` (${formatDollarCompact(data.totalCost)})`
                  : ''}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span
                className="flex items-center gap-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span
                  className="w-3.5 h-0.5 inline-block shrink-0"
                  style={{ backgroundColor: 'var(--chart-budget)' }}
                />
                Total Monthly Budget:
              </span>
              <span className="font-semibold">
                {formatDollarWhole(data.budgetAmount)}
                {data.budgetAmount >= 10000
                  ? ` (${formatDollarCompact(data.budgetAmount)})`
                  : ''}
              </span>
            </div>

            <div
              className="flex items-center justify-between gap-3 pt-1.5 border-t font-semibold"
              style={{
                borderColor: 'var(--border-subtle)',
                color: isOverBudget
                  ? 'var(--status-overrun)'
                  : 'var(--status-optimal)'
              }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block shrink-0"
                  style={{
                    backgroundColor: isOverBudget
                      ? 'var(--status-overrun)'
                      : 'var(--status-optimal)'
                  }}
                />
                {isOverBudget ? 'Over Budget:' : 'Under Budget:'}
              </span>
              <span>
                {isOverBudget
                  ? `+${formatDollarWhole(budgetVariance)} over`
                  : `${formatDollarWhole(Math.abs(budgetVariance))} under`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(tooltipContent, document.body)
    : tooltipContent
}

