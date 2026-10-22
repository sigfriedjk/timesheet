/** Display only meaningful decimal digits while retaining the requested precision. */
export const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : String(Number(value.toFixed(digits)));
