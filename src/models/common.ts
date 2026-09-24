/** ISO 8601 date or date-time string, e.g. '2026-09-24' or '2026-09-24T10:15:00.000Z'. */
export type ISODateString = string;

/** 'YYYY-MM', used as the month-bucketing key across transactions and caching. */
export type MonthKey = string;

export type TransactionType = 'income' | 'expense';
