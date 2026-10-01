import Dexie, { type Table } from 'dexie';
import { APP_SLUG } from '../../config/app';
import type { MetadataGroup } from '../../models/MetadataGroup';
import type {
  StoredFiscalYearSummaryRecord,
  StoredRuleRecord,
  StoredTransactionRecord,
} from './StoredRecords';

export interface SyncOutboxEntry {
  localSeq?: number;
  entityType: 'transaction' | 'rule' | 'metadataGroup';
  entityId: string;
  op: 'upsert' | 'delete';
  payload: unknown;
  createdAt: string;
}

export interface MonthCacheMetaRecord {
  monthKey: string;
  lastAccessedAt: string;
}

export interface AuthConfigRecord {
  id: 'default';
  salt: string;
  verificationHash: string;
}

class FinoPlannerDB extends Dexie {
  transactions!: Table<StoredTransactionRecord, string>;
  rules!: Table<StoredRuleRecord, string>;
  metadataGroups!: Table<MetadataGroup, string>;
  syncOutbox!: Table<SyncOutboxEntry, number>;
  monthCacheMeta!: Table<MonthCacheMetaRecord, string>;
  authConfig!: Table<AuthConfigRecord, string>;
  fySummaries!: Table<StoredFiscalYearSummaryRecord, number>;

  constructor() {
    super(APP_SLUG);
    this.version(1).stores({
      transactions: 'id, monthKey, year, ruleId, ruleGroupId, categoryId, statusKind, updatedAt',
      rules: 'id, ruleGroupId, status, categoryId, effectiveFrom, updatedAt',
      metadataGroups: 'id, key, updatedAt',
      syncOutbox: '++localSeq, entityType, entityId, op, createdAt',
      monthCacheMeta: 'monthKey, lastAccessedAt',
      authConfig: 'id',
    });
    // Additive only — derived, event-maintained FY summary documents (architecture.md §7).
    this.version(2).stores({
      fySummaries: 'fyStartYear, updatedAt',
    });
    // Leaf-only Master Data (architecture.md §2.2): records index the sub-category, not the
    // category. Index change only — the app starts from a clean database, no data migration.
    this.version(3).stores({
      transactions: 'id, monthKey, year, ruleId, ruleGroupId, subCategoryId, statusKind, updatedAt',
      rules: 'id, ruleGroupId, status, subCategoryId, effectiveFrom, updatedAt',
    });
  }
}

export const db = new FinoPlannerDB();
