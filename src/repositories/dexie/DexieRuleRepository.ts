import type { RuleStatus } from '../../models/RecurringRule';
import { db } from './db';
import type { StoredRuleRecord } from './StoredRecords';

/**
 * Raw CRUD over the encrypted-at-rest record shape — no encryption logic here.
 * Wrapped by EncryptingRuleRepository, which is what Services actually use.
 * Insert-only for content: rules are immutable/versioned (models/RecurringRule.ts) —
 * updateStatus() is the one deliberate exception (architecture.md §2.4).
 */
export class DexieRuleRepository {
  async getAll(): Promise<StoredRuleRecord[]> {
    return db.rules.toArray();
  }

  async getById(id: string): Promise<StoredRuleRecord | undefined> {
    return db.rules.get(id);
  }

  async getByRuleGroupId(ruleGroupId: string): Promise<StoredRuleRecord[]> {
    const records = await db.rules.where('ruleGroupId').equals(ruleGroupId).toArray();
    return records.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }

  async save(record: StoredRuleRecord): Promise<void> {
    await db.rules.put(record);
  }

  /** `status` is a clear (unencrypted) column — this never touches cipherPayload/iv. */
  async updateStatus(id: string, status: RuleStatus): Promise<void> {
    await db.rules.update(id, { status, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<void> {
    await db.rules.delete(id);
  }
}
