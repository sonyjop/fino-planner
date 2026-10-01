import type { TransactionType } from '../models/common';
import type { FiscalYearSummary, PlannedCommitted } from '../models/FiscalYearSummary';
import type { Transaction } from '../models/Transaction';
import { ruleRepository, transactionRepository } from '../repositories';
import { fiscalYearMonths } from '../utils/date';
import { computeVirtualPlannedTransactions, mergeStoredWithVirtual } from './RuleEngineService';

export interface MonthSummary {
  /** Income − expense, counting each transaction's actual amount once completed, else its planned amount. */
  projectedBalance: number;
  income: { committed: number; planned: number };
  expenses: { committed: number; planned: number };
}

/** Planned counts every row's plannedAmount; committed only completed rows' actualAmount. */
function committedAmount(tx: Transaction): number {
  return tx.statusKind === 'actual' ? (tx.actualAmount ?? 0) : 0;
}

/** What the row is expected to cost/bring in now: the real figure once completed, else the plan. */
export function effectiveAmount(tx: Transaction): number {
  return tx.statusKind === 'actual' ? (tx.actualAmount ?? 0) : tx.plannedAmount;
}

function totalsFor(transactions: Transaction[], type: TransactionType): { committed: number; planned: number } {
  let planned = 0;
  let committed = 0;
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    planned += tx.plannedAmount;
    committed += committedAmount(tx);
  }
  return { committed, planned };
}

function effectiveTotal(transactions: Transaction[], type: TransactionType): number {
  return transactions.filter((tx) => tx.type === type).reduce((total, tx) => total + effectiveAmount(tx), 0);
}

/** Pure — shared by the async repository path below and by stores that already hold the month in memory. */
export function summarizeTransactions(transactions: Transaction[]): MonthSummary {
  return {
    projectedBalance: effectiveTotal(transactions, 'income') - effectiveTotal(transactions, 'expense'),
    income: totalsFor(transactions, 'income'),
    expenses: totalsFor(transactions, 'expense'),
  };
}

function zero(): PlannedCommitted {
  return { planned: 0, committed: 0 };
}

/**
 * Pure — aggregates an already-merged list (stored rows + unclaimed virtual rule occurrences)
 * into one FY document. Rows outside the FY are ignored, so callers can pass a superset.
 */
export function summarizeFiscalYear(transactions: Transaction[], fyStartYear: number): FiscalYearSummary {
  const months = fiscalYearMonths(fyStartYear).map(({ monthKey }) => ({
    monthKey,
    income: zero(),
    expense: zero(),
  }));
  const monthIndex = new Map(months.map((m, i) => [m.monthKey, i]));
  const categories: FiscalYearSummary['categories'] = { income: {}, expense: {} };

  for (const tx of transactions) {
    const index = monthIndex.get(tx.monthKey);
    if (index === undefined) continue;
    const planned = tx.plannedAmount;
    const committed = committedAmount(tx);

    const monthBucket = months[index][tx.type];
    monthBucket.planned += planned;
    monthBucket.committed += committed;

    const categoryBucket = (categories[tx.type][tx.subCategoryId] ??= zero());
    categoryBucket.planned += planned;
    categoryBucket.committed += committed;
  }

  return { fyStartYear, months, categories, updatedAt: new Date().toISOString() };
}

export const BalanceService = {
  async getMonthSummary(year: number, month: number): Promise<MonthSummary> {
    const transactions = await transactionRepository.getByMonth(year, month);
    return summarizeTransactions(transactions);
  },

  /** Reads the FY's stored rows and rules once, recomputes each month's virtual occurrences, aggregates. */
  async buildAnnualSummary(fyStartYear: number): Promise<FiscalYearSummary> {
    const months = fiscalYearMonths(fyStartYear);
    const [rules, stored] = await Promise.all([
      ruleRepository.getAll(),
      transactionRepository.getByMonthRange(months[0].monthKey, months[11].monthKey),
    ]);

    const merged = months.flatMap(({ year, month, monthKey }) =>
      mergeStoredWithVirtual(
        stored.filter((tx) => tx.monthKey === monthKey),
        computeVirtualPlannedTransactions(rules, year, month),
      ),
    );
    return summarizeFiscalYear(merged, fyStartYear);
  },
};
