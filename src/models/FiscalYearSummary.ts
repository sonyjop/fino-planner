import type { ISODateString, MonthKey, TransactionType } from './common';

export interface PlannedCommitted {
  planned: number;
  committed: number;
}

export type TypeTotals = Record<TransactionType, PlannedCommitted>;

export interface MonthTotals extends TypeTotals {
  monthKey: MonthKey;
}

/**
 * Persisted, derived summary of one financial year (Apr–Mar). Recomputed by
 * FiscalYearSummaryService whenever a transaction or rule changes — never edited directly.
 * Figures are keyed by subCategoryId; the roll-up to categories and names/icons/colours are
 * resolved at render time, so a Master Data rename shows without a recompute.
 */
export interface FiscalYearSummary {
  fyStartYear: number;
  /** Always 12 entries, April first. */
  months: MonthTotals[];
  /** subCategoryId -> totals, per transaction type. */
  categories: Record<TransactionType, Record<string, PlannedCommitted>>;
  updatedAt: ISODateString;
}
