import type { FiscalYearSummary } from '../models/FiscalYearSummary';
import { fiscalYearSummaryRepository } from '../repositories';
import { fiscalYearOfDate, fiscalYearStart } from '../utils/date';
import { BalanceService } from './BalanceService';
import { domainEvents, type DomainEvent } from './domainEvents';

/**
 * Owns the persisted FY summary documents (architecture.md §7): recomputes them whenever a
 * transaction or rule changes, and builds one on first read. Screens only ever read.
 * Derived data — never pushed through the sync outbox.
 */
export const FiscalYearSummaryService = {
  /** The stored document, built and saved first if this FY has never been summarised. */
  async get(fyStartYear: number): Promise<FiscalYearSummary> {
    return (await fiscalYearSummaryRepository.get(fyStartYear)) ?? this.recompute(fyStartYear);
  },

  async recompute(fyStartYear: number): Promise<FiscalYearSummary> {
    const summary = await BalanceService.buildAnnualSummary(fyStartYear);
    await fiscalYearSummaryRepository.save(summary);
    return summary;
  },

  /**
   * A transaction write touches only the FYs of its dates (old and new). A rule write can
   * shift occurrences in any FY, so every stored document is refreshed, plus the current FY.
   */
  async handle(event: DomainEvent): Promise<void> {
    const affected = new Set<number>();
    if (event.type === 'transactionsChanged') {
      for (const date of event.dates) affected.add(fiscalYearOfDate(date));
    } else {
      for (const fy of await fiscalYearSummaryRepository.listFiscalYears()) affected.add(fy);
      affected.add(fiscalYearStart(new Date()));
    }
    for (const fy of affected) await this.recompute(fy);
  },
};

// Registered on import: AppShell pulls this in (via the annual summary store), so every write
// made anywhere in the app keeps the stored documents current.
domainEvents.subscribe((event) => FiscalYearSummaryService.handle(event));
