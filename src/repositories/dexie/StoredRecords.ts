import type { TransactionStatusKind } from '../../models/Transaction';
import type { RuleStatus } from '../../models/RecurringRule';

/**
 * On-disk shape once encryption (architecture.md §8.1) is applied: only the fields
 * Dexie needs to index/query stay as plain columns. Everything else — title, amount,
 * date, notes, instrumentId — lives inside `cipherPayload`.
 */
export interface StoredTransactionRecord {
  id: string;
  monthKey: string;
  year: number;
  subCategoryId: string;
  statusKind: TransactionStatusKind;
  ruleId?: string;
  ruleGroupId?: string;
  updatedAt: string;
  cipherPayload: string; // base64 AES-GCM ciphertext
  iv: string; // base64, unique per record
}

/**
 * On-disk shape for a rule version: name, description, type, amount, schedule fields,
 * startDate, effectiveTo, supersedesId and instrumentId live inside `cipherPayload`.
 */
export interface StoredRuleRecord {
  id: string;
  ruleGroupId: string;
  version: number;
  subCategoryId: string;
  status: RuleStatus;
  effectiveFrom: string;
  updatedAt: string;
  cipherPayload: string;
  iv: string;
}

/**
 * On-disk shape for a persisted FY summary: every figure (months and categories) lives
 * inside `cipherPayload` — only the FY key and updatedAt stay clear.
 */
export interface StoredFiscalYearSummaryRecord {
  fyStartYear: number;
  updatedAt: string;
  cipherPayload: string;
  iv: string;
}
