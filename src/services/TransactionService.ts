import type { TransactionType } from '../models/common';
import type { Transaction, TransactionStatusKind } from '../models/Transaction';
import { transactionRepository } from '../repositories';
import { createId } from '../utils/id';
import { todayDateString } from '../utils/date';
import { RuleEngineService } from './RuleEngineService';

export interface CreateTransactionInput {
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date?: string; // defaults to today (architecture.md §2.1 — "auto = entry date unless changed")
  notes?: string;
  accountId?: string;
  paymentModeId?: string;
  /** Freely bidirectional, settable at creation too (basic-usecases.txt Cashflow #7). Defaults to 'planned'. */
  statusKind?: TransactionStatusKind;
  statusLabelId?: string;
  /** Set only when completing a rule-derived virtual planned item — never set for an adhoc entry. */
  ruleId?: string;
  ruleGroupId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const TransactionService = {
  /**
   * Rule-derived planned items are never stored (RuleEngineService) — this merges whatever's
   * genuinely in the DB for the month (adhoc planned entries, and anything completed) with
   * freshly computed virtual planned occurrences, skipping a virtual one wherever a real row
   * already exists for that rule lineage this month (i.e. it's already been completed).
   */
  async getForMonth(year: number, month: number): Promise<Transaction[]> {
    const [stored, virtual] = await Promise.all([
      transactionRepository.getByMonth(year, month),
      RuleEngineService.getPlannedForMonth(year, month),
    ]);
    const storedRuleGroupIds = new Set(stored.filter((tx) => tx.ruleGroupId).map((tx) => tx.ruleGroupId));
    const unclaimed = virtual.filter((tx) => !storedRuleGroupIds.has(tx.ruleGroupId));
    return [...stored, ...unclaimed];
  },

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const date = input.date ?? todayDateString();
    const now = nowIso();
    const transaction: Transaction = {
      id: createId(),
      title: input.title,
      amount: input.amount,
      type: input.type,
      categoryId: input.categoryId,
      date,
      statusKind: input.statusKind ?? 'planned',
      statusLabelId: input.statusLabelId,
      accountId: input.accountId,
      paymentModeId: input.paymentModeId,
      notes: input.notes,
      ruleId: input.ruleId,
      ruleGroupId: input.ruleGroupId,
      monthKey: date.slice(0, 7),
      year: Number(date.slice(0, 4)),
      createdAt: now,
      updatedAt: now,
    };
    await transactionRepository.save(transaction);
    return transaction;
  },

  async update(id: string, changes: Partial<CreateTransactionInput>): Promise<Transaction> {
    const existing = await transactionRepository.getById(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    const date = changes.date ?? existing.date;
    const updated: Transaction = {
      ...existing,
      ...changes,
      date,
      monthKey: date.slice(0, 7),
      year: Number(date.slice(0, 4)),
      updatedAt: nowIso(),
    };
    await transactionRepository.save(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await transactionRepository.delete(id);
  },
};
