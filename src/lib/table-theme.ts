// Table Theme Utilities
// Provides CSS variables for table branding and styling

import { CSSProperties } from 'react'

export function getTableThemeVars(tableType: 'PREPAID' | 'CAPTAIN_PAYG'): CSSProperties {
  if (tableType === 'PREPAID') {
    return {
      '--table-accent-color': 'hsl(var(--chart-2))', // Gold for prepaid tables
      '--table-progress-gradient': 'linear-gradient(to right, hsl(var(--chart-2)), hsl(var(--chart-3)))',
      '--table-badge-bg': 'hsl(var(--chart-2))',
    } as CSSProperties
  }

  return {
    '--table-accent-color': 'hsl(var(--chart-1))', // Pink for captain tables
    '--table-progress-gradient': 'linear-gradient(to right, hsl(var(--chart-1)), hsl(var(--destructive)))',
    '--table-badge-bg': 'hsl(var(--chart-1))',
  } as CSSProperties
}
