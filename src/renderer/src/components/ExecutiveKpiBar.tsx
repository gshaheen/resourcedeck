import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import { calculateScenarioMonthlyRollup } from '../../../shared/engine/calculator'
import {
  formatDollarCompact,
  formatDollarWhole
} from '../../../shared/engine/formatters'

export const ExecutiveKpiBar: React.FC = () => {
  const { dataset, chartFilter, setChartFilter, isPresentationMode, viewMode } =
    useDeckStore()

  const rollups = useMemo(
    () => calculateScenarioMonthlyRollup(dataset, chartFilter),
    [dataset, chartFilter]
  )

  const filterLabel = useMemo(() => {
    if (chartFilter.type === 'all') return null
    if (chartFilter.type === 'person') {
      const p = dataset.people.find((x) => x.id === chartFilter.value)
      return p ? `Person: ${p.name}` : 'Filtered Person'
    }
    if (chartFilter.type === 'role') return `Role: ${chartFilter.value}`
    if (chartFilter.type === 'department') return `Dept: ${chartFilter.value}`
    return null
  }, [chartFilter, dataset.people])

  if (!isPresentationMode && viewMode !== 'dashboard') {
    return null
  }

  const totalBudget = rollups.reduce((acc, r) => acc + r.budgetAmount, 0)
  const totalProjectedSpend = rollups.reduce((acc, r) => acc + r.totalCost, 0)
  const netBudgetVariance = totalBudget - totalProjectedSpend

  const totalCapacityHours = rollups.reduce((acc, r) => acc + r.capacityHours, 0)
  const totalDemandHours = rollups.reduce((acc, r) => acc + r.totalDemandHours, 0)
  const avgUtilization =
    totalCapacityHours > 0
      ? Math.round((totalDemandHours / totalCapacityHours) * 100)
      : 0

  const peakMonth = rollups.reduce(
    (max, r) => (r.utilizationPercent > max.utilizationPercent ? r : max),
    rollups[0] || { label: 'N/A', utilizationPercent: 0 }
  )

  const overrunMonthsCount = rollups.filter(
    (r) => r.isCapacityOverrun || r.isBudgetOverrun
  ).length

  const activeTimelineCount = dataset.projects.filter(
    (p) => p.status === 'timeline'
  ).length
  const onDeckCount = dataset.projects.filter((p) => p.status === 'on_deck').length

  // Compact single-line architectural ribbon when in Split Presentation Mode to preserve vertical space for Timeline + Dual Charts
  if (isPresentationMode && viewMode === 'split-timeline') {
    return (
      <div
        className="h-9 px-3 border-b flex items-center justify-between gap-4 text-xs shrink-0 overflow-x-auto"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="flex items-center gap-4 tabular-nums shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Spend / Budget:
            </span>
            <span
              className="font-semibold"
              title={`${formatDollarWhole(totalProjectedSpend)} / ${formatDollarWhole(totalBudget)}`}
            >
              {formatDollarCompact(totalProjectedSpend)} / {formatDollarCompact(totalBudget)}
            </span>
            <span
              className="text-[11px] font-medium"
              style={{
                color:
                  netBudgetVariance >= 0
                    ? 'var(--status-optimal)'
                    : 'var(--status-overrun)'
              }}
              title={
                netBudgetVariance >= 0
                  ? `${formatDollarWhole(netBudgetVariance)} under budget`
                  : `${formatDollarWhole(Math.abs(netBudgetVariance))} over budget`
              }
            >
              (
              {netBudgetVariance >= 0
                ? `${formatDollarCompact(netBudgetVariance)} under`
                : `${formatDollarCompact(Math.abs(netBudgetVariance))} over`}
              )
            </span>
          </div>

          <span style={{ color: 'var(--border-strong)' }}>·</span>

          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Utilization:
            </span>
            <span className="font-semibold">{avgUtilization}%</span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              ({Math.round(totalDemandHours).toLocaleString()}/
              {Math.round(totalCapacityHours).toLocaleString()}h · Peak{' '}
              {peakMonth.label} {peakMonth.utilizationPercent}%)
            </span>
          </div>

          <span style={{ color: 'var(--border-strong)' }}>·</span>

          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Status:
            </span>
            <span
              className="font-semibold"
              style={{
                color:
                  overrunMonthsCount > 0
                    ? 'var(--status-overrun)'
                    : 'var(--status-optimal)'
              }}
            >
              {overrunMonthsCount === 0
                ? '0 Overruns'
                : `${overrunMonthsCount} Overrun ${overrunMonthsCount === 1 ? 'Month' : 'Months'}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {filterLabel && (
            <button
              onClick={() => setChartFilter({ type: 'all', value: 'all' })}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-primary)'
              }}
              title="Clear active capacity filter"
            >
              <span>Scoped to {filterLabel}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          <span
            className="text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {activeTimelineCount} Active · {onDeckCount} On Deck
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="px-3 py-2 border-b space-y-1.5 shrink-0"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)'
      }}
    >
      {filterLabel && (
        <div className="flex items-center justify-between text-xs px-1">
          <span style={{ color: 'var(--text-secondary)' }}>
            KPI metrics below are currently filtered to{' '}
            <strong style={{ color: 'var(--accent-primary)' }}>{filterLabel}</strong>
          </span>
          <button
            onClick={() => setChartFilter({ type: 'all', value: 'all' })}
            className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            <span>Reset to All People</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Spend vs Budget */}
        <div
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Projected Spend / Budget
          </div>
          <div
            className="text-base font-editorial font-bold tabular-nums mt-0.5"
            title={`${formatDollarWhole(totalProjectedSpend)} / ${formatDollarWhole(totalBudget)}`}
          >
            {formatDollarCompact(totalProjectedSpend)}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              / {formatDollarCompact(totalBudget)} ({formatDollarWhole(totalProjectedSpend)})
            </span>
          </div>
          <div
            className="text-[11px] font-medium tabular-nums"
            style={{
              color:
                netBudgetVariance >= 0
                  ? 'var(--status-optimal)'
                  : 'var(--status-overrun)'
            }}
          >
            {netBudgetVariance >= 0
              ? `${formatDollarWhole(netBudgetVariance)} under budget`
              : `${formatDollarWhole(Math.abs(netBudgetVariance))} over budget`}
          </div>
        </div>

        {/* Card 2: Utilization */}
        <div
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Demand / Capacity
          </div>
          <div className="text-base font-editorial font-bold tabular-nums mt-0.5">
            {avgUtilization}%{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              ({Math.round(totalDemandHours).toLocaleString()} /{' '}
              {Math.round(totalCapacityHours).toLocaleString()}h)
            </span>
          </div>
          <div
            className="text-[11px] tabular-nums"
            style={{ color: 'var(--text-secondary)' }}
          >
            Peak: {peakMonth.label} ({peakMonth.utilizationPercent}%)
          </div>
        </div>

        {/* Card 3: Overruns */}
        <div
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor:
              overrunMonthsCount > 0 ? 'var(--status-overrun)' : 'var(--border-subtle)'
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Monthly Overruns
          </div>
          <div
            className="text-base font-editorial font-bold tabular-nums mt-0.5"
            style={{
              color:
                overrunMonthsCount > 0
                  ? 'var(--status-overrun)'
                  : 'var(--status-optimal)'
            }}
          >
            {overrunMonthsCount === 0
              ? '0 Overruns'
              : `${overrunMonthsCount} ${overrunMonthsCount === 1 ? 'Month' : 'Months'} Over`}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {overrunMonthsCount === 0
              ? 'Within monthly targets'
              : 'Capacity or budget exceeded'}
          </div>
        </div>

        {/* Card 4: Active Portfolio */}
        <div
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Active Portfolio
          </div>
          <div className="text-base font-editorial font-bold tabular-nums mt-0.5">
            {activeTimelineCount} Scheduled
          </div>
          <div
            className="text-[11px] tabular-nums"
            style={{ color: 'var(--text-secondary)' }}
          >
            {onDeckCount} Staged on Deck
          </div>
        </div>
      </div>
    </div>
  )
}
