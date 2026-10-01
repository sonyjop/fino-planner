import type { FiscalYearSummary } from '../../models/FiscalYearSummary';

export interface FiscalYearSummaryRepository {
  get(fyStartYear: number): Promise<FiscalYearSummary | undefined>;
  /** FY start years that currently have a stored document. */
  listFiscalYears(): Promise<number[]>;
  save(summary: FiscalYearSummary): Promise<void>; // upsert
}
