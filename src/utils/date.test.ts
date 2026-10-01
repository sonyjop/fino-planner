import { describe, expect, it } from 'vitest';
import { fiscalYearLabel, fiscalYearMonths, fiscalYearOfDate, fiscalYearStart, ordinal } from './date';

describe('ordinal', () => {
  it('handles the 11th/12th/13th special case', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
  });

  it('handles the regular 1st/2nd/3rd/nth cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
  });
});

describe('fiscalYearStart / fiscalYearLabel', () => {
  it('treats Jan–Mar as belonging to the previous calendar year\'s FY', () => {
    expect(fiscalYearStart(new Date(2027, 1, 15))).toBe(2026); // Feb 2027 -> FY2026-27
  });

  it('treats Apr–Dec as belonging to the current calendar year\'s FY', () => {
    expect(fiscalYearStart(new Date(2026, 8, 24))).toBe(2026); // Sep 2026 -> FY2026-27
  });

  it('labels a fiscal year as "FY start–end" with an en dash', () => {
    expect(fiscalYearLabel(2026)).toBe('FY 2026–27');
  });

  it('buckets 31 Mar into the previous FY and 1 Apr into the next', () => {
    expect(fiscalYearOfDate('2027-03-31')).toBe(2026);
    expect(fiscalYearOfDate('2027-04-01')).toBe(2027);
    expect(fiscalYearOfDate('2027-01')).toBe(2026);
  });

  it('lists the 12 months of a FY from April to March', () => {
    const months = fiscalYearMonths(2026).map((m) => m.monthKey);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-04');
    expect(months[8]).toBe('2026-12');
    expect(months[9]).toBe('2027-01');
    expect(months[11]).toBe('2027-03');
  });
});
