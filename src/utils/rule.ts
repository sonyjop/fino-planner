import { format, parseISO } from 'date-fns';
import type { RecurringRule } from '../models/RecurringRule';
import { ordinal } from './date';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function describeSchedule(rule: RecurringRule): string {
  if (rule.repeats === 'monthly' && rule.dayOfMonth) {
    return `Monthly · ${ordinal(rule.dayOfMonth)}`;
  }
  if (rule.repeats === 'quarterly' && rule.monthOfYear && rule.dayOfMonth) {
    return `Quarterly from ${MONTH_NAMES[rule.monthOfYear - 1]} · ${ordinal(rule.dayOfMonth)}`;
  }
  if (rule.repeats === 'yearly' && rule.monthOfYear && rule.dayOfMonth) {
    return `Yearly · ${ordinal(rule.dayOfMonth)} ${MONTH_NAMES[rule.monthOfYear - 1]}`;
  }
  return rule.repeats;
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'dd MMM yyyy');
}
