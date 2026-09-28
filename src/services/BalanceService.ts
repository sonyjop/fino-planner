import type { Transaction, TransactionStatusKind } from '../models/Transaction';
import type { TransactionType } from '../models/common';
import { transactionRepository } from '../repositories';

export interface MonthSummary {
  /** Total planned - total expenses for the month, across both planned and actual entries. */
  projectedBalance: number;
  income: { actual: number; total: number };
  expenses: { actual: number; total: number };
}

function sum(transactions: Transaction[], type: TransactionType, onlyKind?: TransactionStatusKind): number {
  return transactions
    .filter((tx) => tx.type === type && (!onlyKind || tx.statusKind === onlyKind))
    .reduce((total, tx) => total + tx.amount, 0);
}

/** Pure — shared by the async repository path below and by stores that already hold the month in memory. */
export function summarizeTransactions(transactions: Transaction[]): MonthSummary {
  const income = { actual: sum(transactions, 'income', 'actual'), total: sum(transactions, 'income') };
  const expenses = { actual: sum(transactions, 'expense', 'actual'), total: sum(transactions, 'expense') };

  return {
    projectedBalance: income.total - expenses.total,
    income,
    expenses,
  };
}

export const BalanceService = {
  async getMonthSummary(year: number, month: number): Promise<MonthSummary> {
    const transactions = await transactionRepository.getByMonth(year, month);
    return summarizeTransactions(transactions);
  },
};
