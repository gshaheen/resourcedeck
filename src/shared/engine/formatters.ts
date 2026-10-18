/**
 * Shared Dollar & Number Formatting Utilities for resourcedeck
 * - All dollar values are rounded to the nearest whole dollar (no decimals for exact values).
 * - All dollar values use commas for readability.
 * - Large dollar amounts can be truncated using familiar patterns ($85k, $1.2M, $1.5B).
 * - Live input helpers format numbers with commas as the user types.
 */

/**
 * Formats a dollar amount rounded to the nearest whole dollar with commas and no decimals.
 * Example: 125430.75 -> "$125,431", -4200 -> "-$4,200"
 */
export function formatDollarWhole(amount: number): string {
  if (!Number.isFinite(amount)) return '$0'
  const rounded = Math.round(amount)
  const sign = rounded < 0 ? '-' : ''
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`
}

/**
 * Formats large dollar amounts using familiar abbreviated patterns ($85k, $1.2M, $2.4B),
 * while keeping smaller amounts (< $10,000) as whole comma-formatted dollars ($8,500).
 */
export function formatDollarCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '$0'
  const rounded = Math.round(amount)
  const abs = Math.abs(rounded)
  const sign = rounded < 0 ? '-' : ''

  if (abs >= 1_000_000_000) {
    const b = abs / 1_000_000_000
    const formatted = b >= 100 ? Math.round(b).toLocaleString('en-US') : Number(b.toFixed(1)).toString()
    return `${sign}$${formatted}B`
  }

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const formatted = m >= 100 ? Math.round(m).toLocaleString('en-US') : Number(m.toFixed(1)).toString()
    return `${sign}$${formatted}M`
  }

  if (abs >= 10_000) {
    const k = Math.round(abs / 1_000)
    return `${sign}$${k.toLocaleString('en-US')}k`
  }

  return `${sign}$${abs.toLocaleString('en-US')}`
}

/**
 * Formats a numeric or string value with commas as the user types in an input field (no $ prefix).
 * Rounds to the nearest whole integer (no decimals).
 * Example: "65000" -> "65,000"
 */
export function formatCommaInput(raw: string | number): string {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return ''
    return Math.round(Math.max(0, raw)).toLocaleString('en-US')
  }
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  if (!digitsOnly) return ''
  const num = Number(digitsOnly)
  if (!Number.isFinite(num)) return ''
  return Math.round(num).toLocaleString('en-US')
}

/**
 * Parses a comma-formatted input string into a whole non-negative integer.
 * Example: "65,000" -> 65000
 */
export function parseCommaInput(raw: string): number {
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  if (!digitsOnly) return 0
  const num = Number(digitsOnly)
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0
}
