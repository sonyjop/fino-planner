import Dexie, { type Table } from 'dexie';
import type { MetadataGroup } from '../../models/MetadataGroup';
import type { StoredRuleRecord, StoredTransactionRecord } from './StoredRecords';

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

class FinoplanDB extends Dexie {
  transactions!: Table<StoredTransactionRecord, string>;
  rules!: Table<StoredRuleRecord, string>;
  metadataGroups!: Table<MetadataGroup, string>;
  syncOutbox!: Table<SyncOutboxEntry, number>;
  monthCacheMeta!: Table<MonthCacheMetaRecord, string>;
  authConfig!: Table<AuthConfigRecord, string>;

  constructor() {
    super('finoplan');
    this.version(1).stores({
      transactions: 'id, monthKey, year, ruleId, ruleGroupId, categoryId, statusKind, updatedAt',
      rules: 'id, ruleGroupId, status, categoryId, effectiveFrom, updatedAt',
      metadataGroups: 'id, key, updatedAt',
      syncOutbox: '++localSeq, entityType, entityId, op, createdAt',
      monthCacheMeta: 'monthKey, lastAccessedAt',
      authConfig: 'id',
    });
  }
}

export const db = new FinoplanDB();
