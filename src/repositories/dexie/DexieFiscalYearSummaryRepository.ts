import { db } from './db';
import type { StoredFiscalYearSummaryRecord } from './StoredRecords';

/**
 * Raw CRUD over the encrypted-at-rest summary shape — no encryption logic here.
 * Wrapped by EncryptingFiscalYearSummaryRepository, which is what Services actually use.
 */
export class DexieFiscalYearSummaryRepository {
  async get(fyStartYear: number): Promise<StoredFiscalYearSummaryRecord | undefined> {
    return db.fySummaries.get(fyStartYear);
  }

  async listFiscalYears(): Promise<number[]> {
    return (await db.fySummaries.toCollection().primaryKeys()) as number[];
  }

  async save(record: StoredFiscalYearSummaryRecord): Promise<void> {
    await db.fySummaries.put(record);
  }
}
