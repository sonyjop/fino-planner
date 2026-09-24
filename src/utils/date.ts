import { format } from 'date-fns';
import type { MonthKey } from '../models/common';

export function toMonthKey(date: Date): MonthKey {
  return format(date, 'yyyy-MM');
}

/** India's fiscal year runs Apr–Mar; returns the calendar year the FY *starts* in. */
export function fiscalYearStart(date: Date): number {
  const month = date.getMonth(); // 0-based; 0 = Jan, 3 = Apr
  return month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function fiscalYearLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}
