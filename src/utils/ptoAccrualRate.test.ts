import { describe, expect, it } from 'vitest';
import { isPtoAccrualRate, parsePtoAccrualRate, requirePtoAccrualRate } from './ptoAccrualRate';

describe('PTO hours earned per worked hour', () => {
  it.each([0, 1, 0.00000001, 0.125, 0.12345678])('retains valid rate precision: %s', (rate) => {
    expect(requirePtoAccrualRate(rate)).toBe(rate);
    expect(parsePtoAccrualRate(String(rate))).toBe(rate);
  });
  it.each([null, undefined, '', '0.125', NaN, Infinity, -0.1, 1.1, 0.123456789])(
    'rejects invalid rates without rounding or defaulting: %s',
    (rate) => {
      expect(isPtoAccrualRate(rate)).toBe(false);
      expect(() => requirePtoAccrualRate(rate)).toThrow('Set a PTO accrual rate');
    },
  );
  it('rejects blank input instead of interpreting it as zero', () => {
    expect(() => parsePtoAccrualRate(' ')).toThrow('Set a PTO accrual rate');
    expect(parsePtoAccrualRate('0')).toBe(0);
    expect(parsePtoAccrualRate('100e-9')).toBe(0.0000001);
    expect(() => parsePtoAccrualRate('0.10000000000000001')).toThrow('Set a PTO accrual rate');
  });
});
