import { db } from './db';
import type { StoredTransactionRecord } from './StoredRecords';

/**
 * Raw CRUD over the encrypted-at-rest record shape — no encryption logic here.
 * Wrapped by EncryptingTransactionRepository, which is what Services actually use.
 */
export class DexieTransactionRepository {
  async getByMonth(year: number, month: number): Promise<StoredTransactionRecord[]> {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    return db.transactions.where('monthKey').equals(monthKey).toArray();
  }

  async getByMonthRange(fromMonthKey: string, toMonthKey: string): Promise<StoredTransactionRecord[]> {
    return db.transactions.where('monthKey').between(fromMonthKey, toMonthKey, true, true).toArray();
  }

  async getById(id: string): Promise<StoredTransactionRecord | undefined> {
    return db.transactions.get(id);
  }

  async getByRuleGroupId(ruleGroupId: string): Promise<StoredTransactionRecord[]> {
    return db.transactions.where('ruleGroupId').equals(ruleGroupId).toArray();
  }

  async getByRuleId(ruleId: string): Promise<StoredTransactionRecord[]> {
    return db.transactions.where('ruleId').equals(ruleId).toArray();
  }

  async save(record: StoredTransactionRecord): Promise<void> {
    await db.transactions.put(record);
  }

  async delete(id: string): Promise<void> {
    await db.transactions.delete(id);
  }
}
