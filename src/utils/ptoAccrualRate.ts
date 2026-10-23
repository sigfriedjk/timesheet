/** Hours of PTO earned per hour worked; never a percentage. */
export function isPtoAccrualRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1 &&
    Number(value.toFixed(8)) === value
  );
}

export function requirePtoAccrualRate(value: unknown): number {
  if (!isPtoAccrualRate(value)) {
    throw new Error(
      'Set a PTO accrual rate from 0 to 1 hours per hour worked, with at most 8 decimal places.',
    );
  }
  return value;
}

export function parsePtoAccrualRate(value: string): number {
  const text = value.trim();
  const parts = text.match(/^[+-]?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!parts || !(parts[1] || parts[2])) return requirePtoAccrualRate(null);
  const digits = parts[1] + (parts[2] ?? '');
  const trailingZeroes = digits.length - digits.replace(/0+$/, '').length;
  const decimalPlaces = (parts[2]?.length ?? 0) - Number(parts[3] ?? 0) - trailingZeroes;
  // Check the entered precision before Number can round excess digits away.
  if (decimalPlaces > 8 && /[1-9]/.test(digits)) return requirePtoAccrualRate(null);
  return requirePtoAccrualRate(Number(text));
}
