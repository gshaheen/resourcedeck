import React, { useEffect, useState } from 'react'
import {
  X,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Trash2,
  Calendar,
  Users
} from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import { compareScenarios } from '../../../shared/engine/diffEngine'

export const ScenarioDiffDrawer: React.FC = () => {
  const {
    dataset,
    baselineDataset,
    isDiffDrawerOpen,
    setDiffDrawerOpen,
    promoteCurrentToBaseline,
    deleteCurrentScenario
  } = useDeckStore()

  const [confirmAction, setConfirmAction] = useState<'promote' | 'discard' | null>(null)

  useEffect(() => {
    setConfirmAction(null)
  }, [dataset.scenario.id, isDiffDrawerOpen])

  useEffect(() => {
    if (!isDiffDrawerOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (confirmAction) {
          setConfirmAction(null)
        } else {
          setDiffDrawerOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDiffDrawerOpen, confirmAction, setDiffDrawerOpen])

  if (!isDiffDrawerOpen || dataset.scenario.isBaseline) {
    return null
  }

  const report = compareScenarios(baselineDataset, dataset)
  const resolvedMonths = report.monthlyDiffs.filter((m) => m.overrunResolved)
  const createdMonths = report.monthlyDiffs.filter((m) => m.overrunCreated)

  return (
    <aside
      role="complementary"
      aria-label="What-If Scenario Diff Report"
      className="w-96 border-l flex flex-col h-full shrink-0 z-30 shadow-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)'
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 className="font-editorial text-sm font-semibold">
              What-If Scenario Diff Report
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Comparing <strong>{dataset.scenario.name}</strong> vs. Baseline
            </p>
          </div>
        </div>
        <button
          onClick={() => setDiffDrawerOpen(false)}
          aria-label="Close scenario diff drawer"
          className="p-1 rounded hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Top Executive Summary Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className="p-3 rounded border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Overrun Months
            </div>
            <div className="text-base font-editorial font-bold mt-0.5 tabular-nums flex items-center gap-1.5">
              <span>{report.summary.baselineOverrunMonths}</span>
              <span>→</span>
              <span
                style={{
                  color:
                    report.summary.currentOverrunMonths <
                    report.summary.baselineOverrunMonths
                      ? 'var(--status-optimal)'
                      : report.summary.currentOverrunMonths >
                          report.summary.baselineOverrunMonths
                        ? 'var(--status-overrun)'
                        : 'var(--text-primary)'
                }}
              >
                {report.summary.currentOverrunMonths}
              </span>
            </div>
          </div>

          <div
            className="p-3 rounded border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Net Spend Delta
            </div>
            <div className="text-base font-editorial font-bold mt-0.5 tabular-nums">
              {report.summary.totalSpendDelta >= 0 ? '+' : '-'}$
              {Math.round(Math.abs(report.summary.totalSpendDelta)).toLocaleString('en-US')}
            </div>
          </div>
        </div>

        {/* Resolved / Created Bottlenecks */}
        {resolvedMonths.length > 0 && (
          <div
            className="p-3 rounded border space-y-1"
            style={{
              backgroundColor: 'var(--status-optimal-bg)',
              borderColor: 'var(--status-optimal)',
              color: 'var(--status-optimal)'
            }}
          >
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Resolved Overruns in {resolvedMonths.length}{' '}
              {resolvedMonths.length === 1 ? 'Month' : 'Months'}
            </div>
            <div className="text-[11px] opacity-90">
              {resolvedMonths.map((m) => m.label).join(', ')} are now within capacity and
              budget targets.
            </div>
          </div>
        )}

        {createdMonths.length > 0 && (
          <div
            className="p-3 rounded border space-y-1"
            style={{
              backgroundColor: 'var(--status-overrun-bg)',
              borderColor: 'var(--status-overrun)',
              color: 'var(--status-overrun)'
            }}
          >
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              New Overruns in {createdMonths.length}{' '}
              {createdMonths.length === 1 ? 'Month' : 'Months'}
            </div>
            <div className="text-[11px] opacity-90">
              {createdMonths.map((m) => m.label).join(', ')} exceeded capacity or budget.
            </div>
          </div>
        )}

        {/* Schedule & Project Changes */}
        <div className="space-y-2">
          <h4
            className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Calendar className="w-3.5 h-3.5" /> Project & Schedule Diffs (
            {report.projectDiffs.length})
          </h4>
          {report.projectDiffs.length === 0 ? (
            <div
              className="p-3 rounded border text-center"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)'
              }}
            >
              No project schedule or cost changes yet. Drag a project on the timeline to compare.
            </div>
          ) : (
            report.projectDiffs.map((pd) => (
              <div
                key={pd.projectId}
                className="p-3 rounded border space-y-1"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold break-words leading-snug">
                    {pd.projectName}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-xs uppercase font-semibold shrink-0"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      color: 'var(--accent-primary)'
                    }}
                  >
                    {pd.changeType.replace(/_/g, ' ')}
                  </span>
                </div>
                {pd.baselineStartDate && pd.currentStartDate && (
                  <div
                    className="text-[11px] tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Dates: {pd.baselineStartDate}..{pd.baselineEndDate} →{' '}
                    <strong>
                      {pd.currentStartDate}..{pd.currentEndDate}
                    </strong>{' '}
                    ({pd.startShiftWeekdays >= 0 ? `+${pd.startShiftWeekdays}d` : `${pd.startShiftWeekdays}d`} shift)
                  </div>
                )}
                {(pd.costDelta !== 0 || pd.hoursDelta !== 0) && (
                  <div
                    className="text-[11px] tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cost Δ: {pd.costDelta >= 0 ? '+' : '-'}$
                    {Math.round(Math.abs(pd.costDelta)).toLocaleString('en-US')} · Hours Δ:{' '}
                    {Math.round(pd.hoursDelta)}h
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Staffing Changes */}
        <div className="space-y-2">
          <h4
            className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Users className="w-3.5 h-3.5" /> Staffing Allocation Diffs (
            {report.staffingDiffs.length})
          </h4>
          {report.staffingDiffs.length === 0 ? (
            <div
              className="p-3 rounded border text-center"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)'
              }}
            >
              No individual hour allocation changes.
            </div>
          ) : (
            report.staffingDiffs.map((sd) => (
              <div
                key={sd.assignmentId}
                className="p-2.5 rounded border flex items-start justify-between gap-2"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold break-words leading-snug">
                    {sd.personName}
                  </div>
                  <div
                    className="text-[10px] break-words leading-snug"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {sd.projectName} ({sd.changeType})
                  </div>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <div className="font-semibold">
                    {Math.round(sd.baselineHours)}h → {Math.round(sd.currentHours)}h
                  </div>
                  <div
                    className="text-[10px]"
                    style={{
                      color:
                        sd.hoursDelta > 0
                          ? 'var(--accent-primary)'
                          : 'var(--accent-secondary)'
                    }}
                  >
                    {sd.hoursDelta > 0 ? `+${sd.hoursDelta}h` : `${sd.hoursDelta}h`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Actions: Two-step guarded Promote to Baseline or Discard Scenario */}
      <div
        className="p-3.5 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {confirmAction === 'promote' ? (
          <div
            className="p-2.5 rounded border space-y-2"
            style={{
              backgroundColor: 'var(--status-optimal-bg)',
              borderColor: 'var(--status-optimal)'
            }}
          >
            <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              Make <strong>{dataset.scenario.name}</strong> the new Official Baseline?
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              The previous baseline ({baselineDataset?.scenario.name || 'Baseline'}) will be preserved as a scenario branch so you can switch back at any time.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-2.5 py-1 rounded border text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmAction(null)
                  void promoteCurrentToBaseline()
                }}
                className="px-3 py-1 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--status-optimal)' }}
              >
                Confirm Promote to Baseline
              </button>
            </div>
          </div>
        ) : confirmAction === 'discard' ? (
          <div
            className="p-2.5 rounded border space-y-2"
            style={{
              backgroundColor: 'var(--status-overrun-bg)',
              borderColor: 'var(--status-overrun)'
            }}
          >
            <div className="text-xs font-medium" style={{ color: 'var(--status-overrun)' }}>
              Permanently delete branch <strong>{dataset.scenario.name}</strong>?
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-2.5 py-1 rounded border text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmAction(null)
                  void deleteCurrentScenario()
                }}
                className="px-3 py-1 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--status-overrun)' }}
              >
                Delete Scenario Branch
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setConfirmAction('discard')}
              className="px-3 py-2 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-85"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--status-overrun)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Discard Branch
            </button>

            <button
              onClick={() => setConfirmAction('promote')}
              className="flex-1 py-2 px-3 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Promote to Baseline
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
