import { describe, expect, it } from 'vitest';
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats with Indian digit grouping and no decimals', () => {
    expect(formatCurrency(120000)).toBe('₹1,20,000');
    expect(formatCurrency(66250)).toBe('₹66,250');
    expect(formatCurrency(0)).toBe('₹0');
  });
});
