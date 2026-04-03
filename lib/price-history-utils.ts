/** Some DBs use created_at, others recorded_at — normalize for sorting and filters. */
export function priceHistoryTimeMs(
  row: { created_at?: string | null; recorded_at?: string | null } | null | undefined
): number {
  if (!row) return 0
  const v = row.created_at ?? row.recorded_at
  if (v == null || v === '') return 0
  const t = new Date(String(v)).getTime()
  return Number.isFinite(t) ? t : 0
}
