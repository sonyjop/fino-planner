import { describe, expect, it } from 'vitest';
import type { Transaction } from '../models/Transaction';
import { summarizeFiscalYear, summarizeTransactions } from './BalanceService';

function tx(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id: 'id',
    title: 'x',
    plannedAmount: 0,
    type: 'expense',
    subCategoryId: 'cat',
    date: '2026-09-01',
    statusKind: 'planned',
    monthKey: '2026-09',
    year: 2026,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('summarizeTransactions', () => {
  it('committed = actual amounts of completed rows; planned = planned amounts of every row', () => {
    const transactions = [
      tx({ type: 'income', plannedAmount: 120000, actualAmount: 120000, statusKind: 'actual' }),
      tx({ type: 'expense', plannedAmount: 24000, actualAmount: 25000, statusKind: 'actual' }),
      tx({ type: 'expense', plannedAmount: 6250 }),
      tx({ type: 'expense', plannedAmount: 0, actualAmount: 3000, statusKind: 'actual' }), // unplanned
    ];

    const summary = summarizeTransactions(transactions);

    expect(summary.income).toEqual({ committed: 120000, planned: 120000 });
    expect(summary.expenses).toEqual({ committed: 28000, planned: 30250 });
    // Projected uses actual once completed, else planned: 120000 − (25000 + 6250 + 3000)
    expect(summary.projectedBalance).toBe(120000 - 34250);
  });

  it('returns zeros for an empty month', () => {
    expect(summarizeTransactions([])).toEqual({
      projectedBalance: 0,
      income: { committed: 0, planned: 0 },
      expenses: { committed: 0, planned: 0 },
    });
  });
});

describe('summarizeFiscalYear', () => {
  it('returns 12 zero months April-first and no categories for an empty FY', () => {
    const summary = summarizeFiscalYear([], 2026);
    expect(summary.months.map((m) => m.monthKey)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    ]);
    for (const month of summary.months) {
      expect(month.income).toEqual({ planned: 0, committed: 0 });
      expect(month.expense).toEqual({ planned: 0, committed: 0 });
    }
    expect(summary.categories).toEqual({ income: {}, expense: {} });
  });

  it('buckets by monthKey and ignores rows outside the FY (31 Mar vs 1 Apr)', () => {
    const summary = summarizeFiscalYear(
      [
        tx({ monthKey: '2027-03', date: '2027-03-31', plannedAmount: 100 }),
        tx({ monthKey: '2027-04', date: '2027-04-01', plannedAmount: 999 }),
      ],
      2026,
    );
    expect(summary.months[11].expense.planned).toBe(100);
    expect(summary.months.reduce((t, m) => t + m.expense.planned, 0)).toBe(100);
  });

  it('adds planned from every row, committed only from completed rows, per category and type', () => {
    const summary = summarizeFiscalYear(
      [
        tx({ monthKey: '2026-06', plannedAmount: 5000, subCategoryId: 'a' }),
        tx({ monthKey: '2026-10', plannedAmount: 0, actualAmount: 3000, statusKind: 'actual', subCategoryId: 'a' }),
        tx({ monthKey: '2026-10', type: 'income', plannedAmount: 50000, actualAmount: 48000, statusKind: 'actual', subCategoryId: 'inc' }),
      ],
      2026,
    );
    expect(summary.months[2].expense).toEqual({ planned: 5000, committed: 0 });
    expect(summary.months[6].expense).toEqual({ planned: 0, committed: 3000 });
    expect(summary.months[6].income).toEqual({ planned: 50000, committed: 48000 });
    expect(summary.categories.expense.a).toEqual({ planned: 5000, committed: 3000 });
    expect(summary.categories.income.inc).toEqual({ planned: 50000, committed: 48000 });
  });
});
