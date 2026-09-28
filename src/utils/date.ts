import { format } from 'date-fns';
import type { MonthKey } from '../models/common';

export function toMonthKey(date: Date): MonthKey {
  return format(date, 'yyyy-MM');
}

export function todayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-based; day 0 rolls back to its last day
}

/** India's fiscal year runs Apr–Mar; returns the calendar year the FY *starts* in. */
export function fiscalYearStart(date: Date): number {
  const month = date.getMonth(); // 0-based; 0 = Jan, 3 = Apr
  return month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function fiscalYearLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}

/** 1 -> '1st', 2 -> '2nd', 12 -> '12th', 21 -> '21st'... */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
