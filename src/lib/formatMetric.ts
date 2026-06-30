/**
 * Shared numeric formatter for UI metrics.
 * Prevents floating-point display artifacts (e.g. 3.199999999999999 → "3.2").
 *
 * Use for CTL, ATL, TSB and other derived metrics displayed in the UI.
 * Do NOT use for integer counts (TSS rounded, HRV, BPM, %).
 */
export function formatMetric(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value == null || !Number.isFinite(value)) return (0).toFixed(decimals);
  return Number(value).toFixed(decimals);
}
