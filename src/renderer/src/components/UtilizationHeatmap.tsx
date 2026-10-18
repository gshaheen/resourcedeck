import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Calendar, Grid3X3, RotateCcw } from 'lucide-react'
import { useDeckStore } from '../store/useDeckStore'
import {
  calculateUtilizationHeatmap,
  getHorizonMonths
} from '../../../shared/engine/calculator'
import type { Person, PersonMonthUtilization } from '../../../shared/types'

type UtilizationFilterLevel =
  | 'ALL'
  | 'UNDER_50'
  | '50_TO_84'
  | '85_TO_99'
  | '100_TO_115'
  | 'BEYOND_115'

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)))
}

/**
 * Clearly delineated spectrum color interpolation for utilization:
 * - 0% – 49%:   Grey (148, 163, 184) -> Soft Sage (74, 175, 115)
 * - 50% – 84%:  Green (22, 163, 74)  -> Rich Green (52, 168, 50)
 * - 85% – 99%:  Yellow (234, 179, 8) -> Deep Amber (234, 115, 12)
 * - 100% – 115%: Red (220, 38, 38)   -> Deep Scarlet Red (185, 28, 28)
 * - > 115%:     "Beyond Red" — Deep Electric Violet / Magenta-Purple (157, 23, 217) -> (107, 33, 168)
 */
function getUtilizationSpectrumStyles(pct: number): {
  backgroundColor: string
  borderColor: string
  solidColor: string
  bandLabel: string
} {
  const clamped = Math.max(0, Math.min(150, pct))

  let r = 148
  let g = 163
  let b = 184
  let bandLabel = 'Low / Bench (0–49%)'

  if (clamped < 50) {
    // 0% – 49%: Grey transitioning smoothly toward soft sage
    const t = clamped / 49
    r = lerp(148, 92, t)
    g = lerp(163, 172, t)
    b = lerp(184, 134, t)
    bandLabel = 'Low / Bench (0–49%)'
  } else if (clamped < 85) {
    // 50% – 84%: Optimal Green
    const t = (clamped - 50) / 34
    r = lerp(22, 52, t)
    g = lerp(163, 168, t)
    b = lerp(74, 50, t)
    bandLabel = 'Optimal (50–84%)'
  } else if (clamped < 100) {
    // 85% – 99%: Yellow / Amber (Near Capacity)
    const t = (clamped - 85) / 14
    r = lerp(234, 234, t)
    g = lerp(179, 120, t)
    b = lerp(8, 12, t)
    bandLabel = 'Near Capacity (85–99%)'
  } else if (clamped <= 115) {
    // 100% – 115%: Red (Overrun)
    const t = (clamped - 100) / 15
    r = lerp(220, 185, t)
    g = lerp(38, 28, t)
    b = lerp(38, 28, t)
    bandLabel = 'Overrun (100–115%)'
  } else {
    // > 115%: "Beyond Red" — Deep Electric Violet / Magenta-Purple (Critical Overload)
    const t = Math.min(1, (clamped - 115) / 35)
    r = lerp(168, 118, t)
    g = lerp(28, 20, t)
    b = lerp(218, 185, t)
    bandLabel = 'Critical Overload (>115%)'
  }

  const alphaBg = clamped === 0 ? 0.28 : clamped > 115 ? 0.85 : clamped >= 100 ? 0.8 : 0.74
  const alphaBorder = clamped >= 100 ? 0.96 : 0.82

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${alphaBg})`,
    borderColor: `rgba(${r}, ${g}, ${b}, ${alphaBorder})`,
    solidColor: `rgb(${r}, ${g}, ${b})`,
    bandLabel
  }
}

interface HoveredHeatmapCell {
  person: Person
  monthLabel: string
  yearMonth: string
  cell: PersonMonthUtilization
  anchorRect: DOMRect
}

export const UtilizationHeatmap: React.FC = () => {
  const { dataset, chartFilter, setChartFilter } = useDeckStore()
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [utilLevelFilter, setUtilLevelFilter] = useState<UtilizationFilterLevel>('ALL')

  const fullHorizon = useMemo(() => getHorizonMonths(dataset), [dataset])

  const [startYearMonth, setStartYearMonth] = useState<string>(
    fullHorizon[0]?.yearMonth ?? ''
  )
  const [endYearMonth, setEndYearMonth] = useState<string>(
    fullHorizon[fullHorizon.length - 1]?.yearMonth ?? ''
  )

  // Keep date range bounds valid when scenario/horizon changes
  useEffect(() => {
    if (fullHorizon.length === 0) return
    const first = fullHorizon[0].yearMonth
    const last = fullHorizon[fullHorizon.length - 1].yearMonth
    const validSet = new Set(fullHorizon.map((m) => m.yearMonth))
    if (!startYearMonth || !validSet.has(startYearMonth)) {
      setStartYearMonth(first)
    }
    if (!endYearMonth || !validSet.has(endYearMonth)) {
      setEndYearMonth(last)
    }
  }, [fullHorizon, startYearMonth, endYearMonth])

  // Filtered horizon based on selected Date Range
  const visibleHorizon = useMemo(() => {
    const lo =
      startYearMonth && endYearMonth && startYearMonth > endYearMonth
        ? endYearMonth
        : startYearMonth
    const hi =
      startYearMonth && endYearMonth && startYearMonth > endYearMonth
        ? startYearMonth
        : endYearMonth
    return fullHorizon.filter((m) => {
      if (lo && m.yearMonth < lo) return false
      if (hi && m.yearMonth > hi) return false
      return true
    })
  }, [fullHorizon, startYearMonth, endYearMonth])

  const isDateRangeFiltered =
    fullHorizon.length > 0 &&
    (startYearMonth !== fullHorizon[0].yearMonth ||
      endYearMonth !== fullHorizon[fullHorizon.length - 1].yearMonth)

  const rows = useMemo(
    () => calculateUtilizationHeatmap(dataset, chartFilter.includeTentative),
    [dataset, chartFilter.includeTentative]
  )

  const projectColorMap = useMemo(
    () => new Map(dataset.projects.map((p) => [p.id, p.color])),
    [dataset.projects]
  )

  const uniqueRoles = useMemo(
    () => Array.from(new Set(dataset.people.map((p) => p.role))),
    [dataset.people]
  )

  // Recompute Avg & Peak across the currently visible date range so filters and summary columns match the date range
  const scopedRows = useMemo(() => {
    return rows.map((r) => {
      let sum = 0
      let count = 0
      let peak = 0
      for (const m of visibleHorizon) {
        const cell = r.months[m.yearMonth]
        if (cell && cell.status !== 'inactive') {
          sum += cell.utilizationPercent
          count++
          if (cell.utilizationPercent > peak) {
            peak = cell.utilizationPercent
          }
        }
      }
      return {
        ...r,
        scopedAverage: count > 0 ? Math.round(sum / count) : 0,
        scopedPeak: peak
      }
    })
  }, [rows, visibleHorizon])

  const filteredRows = useMemo(() => {
    return scopedRows.filter((r) => {
      if (roleFilter !== 'ALL' && r.person.role !== roleFilter) {
        return false
      }
      if (utilLevelFilter === 'UNDER_50') {
        return r.scopedAverage < 50
      }
      if (utilLevelFilter === '50_TO_84') {
        return r.scopedAverage >= 50 && r.scopedAverage < 85
      }
      if (utilLevelFilter === '85_TO_99') {
        return r.scopedAverage >= 85 && r.scopedAverage < 100
      }
      if (utilLevelFilter === '100_TO_115') {
        return r.scopedPeak >= 100 && r.scopedPeak <= 115
      }
      if (utilLevelFilter === 'BEYOND_115') {
        return r.scopedPeak > 115
      }
      return true
    })
  }, [scopedRows, roleFilter, utilLevelFilter])

  const [hoveredCell, setHoveredCell] = useState<HoveredHeatmapCell | null>(null)

  return (
    <section
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Header Controls */}
      <div
        className="px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-1">
            <Grid3X3 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="font-editorial text-sm font-semibold">
              Team & Role Utilization Heatmap
            </h2>
          </div>

          {/* Role Filter */}
          <select
            aria-label="Filter heatmap by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2 py-1 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="ALL">All Roles ({dataset.people.length})</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Utilization Level Filter */}
          <select
            aria-label="Filter heatmap by utilization level"
            value={utilLevelFilter}
            onChange={(e) =>
              setUtilLevelFilter(e.target.value as UtilizationFilterLevel)
            }
            className="px-2 py-1 rounded border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor:
                utilLevelFilter !== 'ALL'
                  ? 'var(--accent-primary)'
                  : 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="ALL">All Utilization Levels</option>
            <option value="UNDER_50">0–49% · Low / Bench (Avg)</option>
            <option value="50_TO_84">50–84% · Optimal (Avg)</option>
            <option value="85_TO_99">85–99% · Near Capacity (Avg)</option>
            <option value="100_TO_115">100–115% · Overrun (Peak)</option>
            <option value="BEYOND_115">&gt;115% · Critical Overload (Peak)</option>
          </select>

          {/* Date Range Filter (From Month -> To Month) */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: isDateRangeFiltered
                ? 'var(--accent-primary)'
                : 'var(--border-strong)',
              color: 'var(--text-primary)'
            }}
          >
            <Calendar
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: 'var(--text-secondary)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Range:
            </span>
            <select
              aria-label="Heatmap start month"
              value={startYearMonth}
              onChange={(e) => {
                const nextStart = e.target.value
                setStartYearMonth(nextStart)
                if (endYearMonth && nextStart > endYearMonth) {
                  setEndYearMonth(nextStart)
                }
              }}
              className="bg-transparent font-medium cursor-pointer focus:outline-none tabular-nums"
            >
              {fullHorizon.map((m) => (
                <option key={`start-${m.yearMonth}`} value={m.yearMonth}>
                  {format(new Date(m.year, m.month - 1, 1), 'MMM yyyy')}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <select
              aria-label="Heatmap end month"
              value={endYearMonth}
              onChange={(e) => {
                const nextEnd = e.target.value
                setEndYearMonth(nextEnd)
                if (startYearMonth && nextEnd < startYearMonth) {
                  setStartYearMonth(nextEnd)
                }
              }}
              className="bg-transparent font-medium cursor-pointer focus:outline-none tabular-nums"
            >
              {fullHorizon.map((m) => (
                <option key={`end-${m.yearMonth}`} value={m.yearMonth}>
                  {format(new Date(m.year, m.month - 1, 1), 'MMM yyyy')}
                </option>
              ))}
            </select>
            {isDateRangeFiltered && (
              <button
                onClick={() => {
                  if (fullHorizon.length > 0) {
                    setStartYearMonth(fullHorizon[0].yearMonth)
                    setEndYearMonth(fullHorizon[fullHorizon.length - 1].yearMonth)
                  }
                }}
                className="ml-1 p-0.5 rounded hover:opacity-80"
                style={{ color: 'var(--accent-primary)' }}
                title="Reset date range to full horizon"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={chartFilter.includeTentative}
              onChange={(e) => setChartFilter({ includeTentative: e.target.checked })}
              className="rounded-none"
            />
            <span>Include Tentative</span>
          </label>
        </div>

        {/* Clearly Delineated Utilization Spectrum Bar:
            0–49% Grey -> 50–84% Green -> 85–99% Yellow -> 100–115% Red -> >115% Violet (Beyond Red) */}
        <div
          className="flex items-center gap-1.5 text-[10px] tabular-nums select-none"
          title="Utilization spectrum delineations: 0–49% Grey (Bench), 50–84% Green (Optimal), 85–99% Yellow (Near Capacity), 100–115% Red (Overrun), >115% Violet (Critical Overload)"
        >
          <span
            className="text-[10px] font-medium mr-0.5 hidden xl:inline"
            style={{ color: 'var(--text-muted)' }}
          >
            Spectrum:
          </span>
          <div
            className="grid grid-cols-5 border rounded-xs overflow-hidden"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            {/* Band 1: 0–49% Grey */}
            <div
              className="px-2 py-0.5 border-r flex flex-col items-center leading-tight"
              style={{
                borderColor: 'var(--border-subtle)',
                background:
                  'linear-gradient(90deg, rgba(148,163,184,0.32) 0%, rgba(110,168,150,0.48) 100%)'
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                0–49%
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                Bench
              </span>
            </div>

            {/* Band 2: 50–84% Green */}
            <div
              className="px-2 py-0.5 border-r flex flex-col items-center leading-tight"
              style={{
                borderColor: 'var(--border-subtle)',
                background:
                  'linear-gradient(90deg, rgba(22,163,74,0.55) 0%, rgba(52,168,50,0.68) 100%)'
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                50–84%
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                Optimal
              </span>
            </div>

            {/* Band 3: 85–99% Yellow */}
            <div
              className="px-2 py-0.5 border-r flex flex-col items-center leading-tight"
              style={{
                borderColor: 'var(--border-subtle)',
                background:
                  'linear-gradient(90deg, rgba(234,179,8,0.62) 0%, rgba(234,120,12,0.72) 100%)'
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                85–99%
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                Near Cap
              </span>
            </div>

            {/* Band 4: 100–115% Red */}
            <div
              className="px-2 py-0.5 border-r flex flex-col items-center leading-tight"
              style={{
                borderColor: 'var(--border-subtle)',
                background:
                  'linear-gradient(90deg, rgba(220,38,38,0.72) 0%, rgba(185,28,28,0.82) 100%)'
              }}
            >
              <span className="font-bold text-white">100–115%</span>
              <span className="text-[9px] text-white/90">Overrun</span>
            </div>

            {/* Band 5: >115% Beyond Red (Deep Electric Violet) */}
            <div
              className="px-2 py-0.5 flex flex-col items-center leading-tight"
              style={{
                background:
                  'linear-gradient(90deg, rgba(168,28,218,0.82) 0%, rgba(118,20,185,0.92) 100%)'
              }}
            >
              <span className="font-bold text-white">&gt;115%</span>
              <span className="text-[9px] text-white/90">Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Matrix Table — Standard square utilization blocks with horizontal scroll when needed */}
      <div className="flex-1 overflow-auto p-3">
        <div
          className="rounded border inline-block min-w-full align-top"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr
                className="border-b text-left"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <th
                  className="sticky left-0 z-20 py-2.5 px-3 font-semibold min-w-[230px] border-r"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  Resource / Role
                </th>
                <th className="py-2.5 px-2.5 font-semibold text-center tabular-nums w-14 shrink-0">
                  Avg
                </th>
                <th
                  className="py-2.5 px-2.5 font-semibold text-center tabular-nums w-14 border-r shrink-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Peak
                </th>
                {visibleHorizon.map((m) => (
                  <th
                    key={m.yearMonth}
                    className="py-2.5 px-1.5 font-semibold text-center tabular-nums min-w-[52px] whitespace-nowrap"
                  >
                    {format(new Date(m.year, m.month - 1, 1), 'MMM yy')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + visibleHorizon.length}
                    className="py-8 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    No resources match the selected role, utilization level, and date range filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.person.id}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td
                      className="sticky left-0 z-10 py-2 px-3 border-r align-middle min-w-[230px]"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)'
                      }}
                    >
                      <div className="font-semibold flex flex-wrap items-center gap-1.5 break-words leading-snug">
                        <span>{row.person.name}</span>
                        {row.person.isPlaceholder && (
                          <span
                            className="text-[9px] uppercase px-1.5 py-0.2 rounded-xs font-semibold shrink-0"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              color: 'var(--accent-primary)'
                            }}
                          >
                            TBD
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[10px] break-words leading-snug mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {row.person.role} · {row.person.department}
                        {row.person.startDate
                          ? ` · Starts ${row.person.startDate}`
                          : ''}
                      </div>
                    </td>

                    <td className="py-2 px-2 text-center font-semibold tabular-nums">
                      {row.scopedAverage}%
                    </td>

                    <td
                      className="py-2 px-2 text-center font-bold tabular-nums border-r"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        color:
                          row.scopedPeak > 100
                            ? 'var(--status-overrun)'
                            : 'var(--text-primary)'
                      }}
                    >
                      {row.scopedPeak}%
                    </td>

                    {visibleHorizon.map((m) => {
                      const cell = row.months[m.yearMonth]
                      const monthLabel = format(
                        new Date(m.year, m.month - 1, 1),
                        'MMMM yyyy'
                      )

                      if (!cell || cell.status === 'inactive') {
                        return (
                          <td
                            key={m.yearMonth}
                            className="p-1.5 text-center align-middle"
                          >
                            <div className="flex items-center justify-center">
                              <div
                                onMouseEnter={(e) =>
                                  setHoveredCell({
                                    person: row.person,
                                    monthLabel,
                                    yearMonth: m.yearMonth,
                                    cell: cell ?? {
                                      personId: row.person.id,
                                      yearMonth: m.yearMonth,
                                      availableWeekdays: 0,
                                      ptoDays: 0,
                                      capacityHours: 0,
                                      confirmedHours: 0,
                                      tentativeHours: 0,
                                      totalDemandHours: 0,
                                      utilizationPercent: 0,
                                      status: 'inactive',
                                      projectAllocations: []
                                    },
                                    anchorRect: e.currentTarget.getBoundingClientRect()
                                  })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                                className="w-8 h-8 border transition-transform hover:scale-110"
                                style={{
                                  backgroundColor: 'var(--bg-canvas)',
                                  borderColor: 'var(--border-subtle)'
                                }}
                                aria-label={`${row.person.name}, ${monthLabel}: Inactive`}
                              />
                            </div>
                          </td>
                        )
                      }

                      const spectrum = getUtilizationSpectrumStyles(
                        cell.utilizationPercent
                      )

                      const isHoveredThisCell =
                        hoveredCell?.person.id === row.person.id &&
                        hoveredCell?.yearMonth === m.yearMonth

                      return (
                        <td
                          key={m.yearMonth}
                          className="p-1.5 text-center align-middle"
                        >
                          <div className="flex items-center justify-center">
                            <div
                              tabIndex={0}
                              onMouseEnter={(e) =>
                                setHoveredCell({
                                  person: row.person,
                                  monthLabel,
                                  yearMonth: m.yearMonth,
                                  cell,
                                  anchorRect: e.currentTarget.getBoundingClientRect()
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              onFocus={(e) =>
                                setHoveredCell({
                                  person: row.person,
                                  monthLabel,
                                  yearMonth: m.yearMonth,
                                  cell,
                                  anchorRect: e.currentTarget.getBoundingClientRect()
                                })
                              }
                              onBlur={() => setHoveredCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setHoveredCell(null)
                                }
                              }}
                              className="relative w-8 h-8 border cursor-pointer transition-transform hover:scale-110 focus:scale-110 focus:outline-none"
                              style={{
                                backgroundColor: spectrum.backgroundColor,
                                borderColor: isHoveredThisCell
                                  ? 'var(--text-primary)'
                                  : spectrum.borderColor,
                                boxShadow: isHoveredThisCell
                                  ? '0 0 0 1.5px var(--text-primary)'
                                  : undefined
                              }}
                              aria-label={`${row.person.name}, ${monthLabel}: ${cell.utilizationPercent}% utilization (${Math.round(cell.totalDemandHours)}h of ${Math.round(cell.capacityHours)}h)`}
                            >
                              {cell.utilizationPercent > 100 && (
                                <span
                                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5"
                                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)' }}
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Styled Floating Utilization Info Panel on Mouseover */}
      {hoveredCell && (
        <HeatmapCellHoverPanel
          info={hoveredCell}
          projectColorMap={projectColorMap}
        />
      )}
    </section>
  )
}

const HeatmapCellHoverPanel: React.FC<{
  info: HoveredHeatmapCell
  projectColorMap: Map<string, string>
}> = ({ info, projectColorMap }) => {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: info.anchorRect.left,
    top: info.anchorRect.bottom + 8
  })

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 12

    // Center horizontally on the square block, then clamp to viewport
    let left =
      info.anchorRect.left + info.anchorRect.width / 2 - rect.width / 2
    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad)
    }
    if (left < pad) {
      left = pad
    }

    // Place below the square block by default; flip above if near bottom of screen
    let top = info.anchorRect.bottom + 8
    if (top + rect.height > vh - pad) {
      top = Math.max(pad, info.anchorRect.top - rect.height - 8)
    }

    setPos({ left, top })
  }, [info])

  const { person, monthLabel, cell } = info
  const spectrum = getUtilizationSpectrumStyles(cell.utilizationPercent)

  const panel = (
    <div
      ref={panelRef}
      style={{
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        width: '310px',
        zIndex: 9999,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)'
      }}
      className="fixed rounded border p-3.5 shadow-2xl space-y-2.5 text-xs pointer-events-none"
    >
      {/* Header: Person Name, Role & Month */}
      <div
        className="flex items-start justify-between gap-2 pb-2 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="min-w-0">
          <div className="font-editorial font-semibold text-sm break-words leading-snug">
            {person.name}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {person.role} · {person.department}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-xs whitespace-nowrap">{monthLabel}</div>
          <div
            className="text-[10px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {cell.availableWeekdays} working days
          </div>
        </div>
      </div>

      {cell.status === 'inactive' ? (
        <div className="py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Not active during this month
          {person.startDate ? ` (Starts ${person.startDate})` : ''}.
        </div>
      ) : (
        <>
          {/* Utilization & Demand vs Capacity Summary Box */}
          <div
            className="p-2.5 rounded border flex items-center justify-between gap-2 tabular-nums"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 border shrink-0"
                style={{
                  backgroundColor: spectrum.backgroundColor,
                  borderColor: spectrum.borderColor
                }}
              />
              <div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {spectrum.bandLabel}
                </div>
                <div
                  className="font-editorial font-bold text-sm"
                  style={{
                    color:
                      cell.utilizationPercent > 115
                        ? spectrum.solidColor
                        : cell.utilizationPercent >= 100
                          ? 'var(--status-overrun)'
                          : 'var(--text-primary)'
                  }}
                >
                  {cell.utilizationPercent}%
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Demand / Capacity
              </div>
              <div className="font-semibold text-xs">
                {Math.round(cell.totalDemandHours)}h / {Math.round(cell.capacityHours)}h
              </div>
            </div>
          </div>

          {/* Confirmed / Tentative / Time Off Details */}
          <div className="space-y-1 tabular-nums text-[11px]">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Confirmed Demand:</span>
              <span className="font-medium">{Math.round(cell.confirmedHours)}h</span>
            </div>
            {cell.tentativeHours > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Tentative Demand:</span>
                <span className="font-medium">{Math.round(cell.tentativeHours)}h</span>
              </div>
            )}
            {cell.ptoDays > 0 && (
              <div
                className="flex items-center justify-between font-medium"
                style={{ color: 'var(--accent-primary)' }}
              >
                <span>Time Off Deducted:</span>
                <span>{cell.ptoDays} working {cell.ptoDays === 1 ? 'day' : 'days'}</span>
              </div>
            )}
          </div>

          {/* Project Allocations Breakdown */}
          <div
            className="pt-2 border-t space-y-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Project Allocations ({cell.projectAllocations.length})
            </div>
            {cell.projectAllocations.length === 0 ? (
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                No project allocations in this month (100% bench capacity).
              </div>
            ) : (
              cell.projectAllocations.map((pa) => {
                const pColor =
                  projectColorMap.get(pa.projectId) || 'var(--accent-primary)'
                return (
                  <div
                    key={pa.projectId}
                    className="flex items-start justify-between gap-2 text-[11px] tabular-nums"
                  >
                    <span
                      className="flex items-start gap-1.5 break-words leading-snug"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="w-2.5 h-2.5 mt-0.5 shrink-0"
                        style={{ backgroundColor: pColor }}
                      />
                      <span>
                        {pa.projectName}
                        {pa.certainty === 'tentative' ? ' (Tentative)' : ''}
                      </span>
                    </span>
                    <span className="font-semibold shrink-0">
                      {Math.round(pa.hours)}h
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(panel, document.body)
    : panel
}
