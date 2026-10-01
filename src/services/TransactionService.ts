import type { TransactionType } from '../models/common';
import type { Transaction, TransactionStatusKind } from '../models/Transaction';
import { transactionRepository } from '../repositories';
import { createId } from '../utils/id';
import { todayDateString } from '../utils/date';
import { domainEvents } from './domainEvents';
import { MetadataService } from './MetadataService';
import { mergeStoredWithVirtual, RuleEngineService } from './RuleEngineService';

export interface CreateTransactionInput {
  title: string;
  /** What's planned. Ignored (forced to 0) when creating an adhoc transaction directly as completed. */
  plannedAmount?: number;
  /** What was actually paid. Only kept while completed; defaults to plannedAmount when completing. */
  actualAmount?: number;
  type: TransactionType;
  /** The leaf only — the category is derived from it (architecture.md §2.2). */
  subCategoryId: string;
  date?: string; // defaults to today (architecture.md §2.1 — "auto = entry date unless changed")
  notes?: string;
  /** Optional card/UPI/bank instrument — the payment mode is derived from it. */
  instrumentId?: string;
  /** Freely bidirectional, settable at creation too (basic-usecases.txt Cashflow #7). Defaults to 'planned'. */
  statusKind?: TransactionStatusKind;
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
   * genuinely in the DB for the month with freshly computed virtual planned occurrences.
   */
  async getForMonth(year: number, month: number): Promise<Transaction[]> {
    const [stored, virtual] = await Promise.all([
      transactionRepository.getByMonth(year, month),
      RuleEngineService.getPlannedForMonth(year, month),
    ]);
    return mergeStoredWithVirtual(stored, virtual);
  },

  /**
   * transactions.feature: created as planned -> plannedAmount = the entered value. Created
   * directly as completed with no rule behind it -> nothing was planned, so plannedAmount = 0
   * and actualAmount = the entered value. Completing a rule occurrence keeps the rule's
   * planned amount, with actual defaulting to it.
   */
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const date = input.date ?? todayDateString();
    const now = nowIso();
    const statusKind = input.statusKind ?? 'planned';
    const isUnplannedCompletion = statusKind === 'actual' && !input.ruleGroupId;
    const plannedAmount = isUnplannedCompletion ? 0 : (input.plannedAmount ?? 0);
    const actualAmount =
      statusKind === 'actual' ? (input.actualAmount ?? input.plannedAmount ?? 0) : undefined;

    const transaction: Transaction = {
      id: createId(),
      title: input.title,
      plannedAmount,
      actualAmount,
      type: input.type,
      subCategoryId: input.subCategoryId,
      date,
      statusKind,
      instrumentId: input.instrumentId,
      notes: input.notes,
      ruleId: input.ruleId,
      ruleGroupId: input.ruleGroupId,
      monthKey: date.slice(0, 7),
      year: Number(date.slice(0, 4)),
      createdAt: now,
      updatedAt: now,
    };
    await transactionRepository.save(transaction);
    await MetadataService.markUsed([transaction.subCategoryId, transaction.instrumentId]);
    await domainEvents.emit({ type: 'transactionsChanged', dates: [date] });
    return transaction;
  },

  /**
   * Completing keeps plannedAmount and defaults actualAmount to it unless given. Moving back
   * to planned clears actualAmount and leaves plannedAmount as it was (0 for a transaction
   * that was created directly as completed).
   */
  async update(id: string, changes: Partial<CreateTransactionInput>): Promise<Transaction> {
    const existing = await transactionRepository.getById(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    const date = changes.date ?? existing.date;
    const statusKind = changes.statusKind ?? existing.statusKind;
    const plannedAmount = changes.plannedAmount ?? existing.plannedAmount;
    const actualAmount =
      statusKind === 'actual' ? (changes.actualAmount ?? existing.actualAmount ?? plannedAmount) : undefined;

    const updated: Transaction = {
      ...existing,
      ...changes,
      plannedAmount,
      actualAmount,
      statusKind,
      date,
      monthKey: date.slice(0, 7),
      year: Number(date.slice(0, 4)),
      updatedAt: nowIso(),
    };
    await transactionRepository.save(updated);
    await MetadataService.markUsed([updated.subCategoryId, updated.instrumentId]);
    await domainEvents.emit({ type: 'transactionsChanged', dates: [existing.date, date] });
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existing = await transactionRepository.getById(id);
    await transactionRepository.delete(id);
    if (existing) await domainEvents.emit({ type: 'transactionsChanged', dates: [existing.date] });
  },
};
