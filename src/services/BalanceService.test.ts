import { describe, expect, it } from 'vitest';
import type { Transaction } from '../models/Transaction';
import { summarizeTransactions } from './BalanceService';

function tx(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id: 'id',
    title: 'x',
    amount: 0,
    type: 'expense',
    categoryId: 'cat',
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
  it('actual = sum of statusKind=actual only; total = sum of everything (test case #1)', () => {
    const transactions = [
      tx({ type: 'income', amount: 120000, statusKind: 'actual' }),
      tx({ type: 'expense', amount: 24000, statusKind: 'actual' }),
      tx({ type: 'expense', amount: 6250, statusKind: 'planned' }),
      tx({ type: 'expense', amount: 11450, statusKind: 'planned' }),
    ];

    const summary = summarizeTransactions(transactions);

    expect(summary.income).toEqual({ actual: 120000, total: 120000 });
    expect(summary.expenses).toEqual({ actual: 24000, total: 41700 });
    expect(summary.projectedBalance).toBe(120000 - 41700);
  });

  it('returns zeros for an empty month', () => {
    expect(summarizeTransactions([])).toEqual({
      projectedBalance: 0,
      income: { actual: 0, total: 0 },
      expenses: { actual: 0, total: 0 },
    });
  });
});
