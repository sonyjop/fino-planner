import type { Transaction } from '../../models/Transaction';

export interface TransactionRepository {
  getByMonth(year: number, month: number): Promise<Transaction[]>;
  /** Inclusive range of 'YYYY-MM' keys — e.g. one financial year. */
  getByMonthRange(fromMonthKey: string, toMonthKey: string): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | undefined>;
  /** Full lineage history — every transaction ever produced by any version of a rule. */
  getByRuleGroupId(ruleGroupId: string): Promise<Transaction[]>;
  getByRuleId(ruleId: string): Promise<Transaction[]>;
  save(tx: Transaction): Promise<void>; // upsert
  delete(id: string): Promise<void>;
}
