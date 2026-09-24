import type { Transaction } from '../../../models/Transaction';
import type { CryptoService } from '../../../services/CryptoService';
import type { TransactionRepository } from '../../interfaces/TransactionRepository';
import type { DexieTransactionRepository } from '../DexieTransactionRepository';
import type { StoredTransactionRecord } from '../StoredRecords';

/** The fields that get encrypted into `cipherPayload` — everything not needed for a Dexie index. */
type EncryptedTransactionFields = Pick<
  Transaction,
  | 'title'
  | 'amount'
  | 'type'
  | 'date'
  | 'notes'
  | 'accountId'
  | 'paymentModeId'
  | 'statusLabelId'
  | 'createdAt'
>;

/**
 * Implements the domain TransactionRepository by wrapping the raw Dexie CRUD layer
 * with encrypt-before-write / decrypt-after-read (architecture.md §8.3). Services only
 * ever see this — never DexieTransactionRepository directly.
 */
export class EncryptingTransactionRepository implements TransactionRepository {
  constructor(
    private readonly raw: DexieTransactionRepository,
    private readonly crypto: CryptoService,
  ) {}

  async getByMonth(year: number, month: number): Promise<Transaction[]> {
    const records = await this.raw.getByMonth(year, month);
    return Promise.all(records.map((r) => this.toDomain(r)));
  }

  async getById(id: string): Promise<Transaction | undefined> {
    const record = await this.raw.getById(id);
    return record ? this.toDomain(record) : undefined;
  }

  async getByRuleGroupId(ruleGroupId: string): Promise<Transaction[]> {
    const records = await this.raw.getByRuleGroupId(ruleGroupId);
    return Promise.all(records.map((r) => this.toDomain(r)));
  }

  async getByRuleId(ruleId: string): Promise<Transaction[]> {
    const records = await this.raw.getByRuleId(ruleId);
    return Promise.all(records.map((r) => this.toDomain(r)));
  }

  async save(tx: Transaction): Promise<void> {
    await this.raw.save(await this.toStored(tx));
  }

  async delete(id: string): Promise<void> {
    await this.raw.delete(id);
  }

  private async toStored(tx: Transaction): Promise<StoredTransactionRecord> {
    const encryptedFields: EncryptedTransactionFields = {
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      notes: tx.notes,
      accountId: tx.accountId,
      paymentModeId: tx.paymentModeId,
      statusLabelId: tx.statusLabelId,
      createdAt: tx.createdAt,
    };
    const { cipherPayload, iv } = await this.crypto.encrypt(encryptedFields);
    return {
      id: tx.id,
      monthKey: tx.monthKey,
      year: tx.year,
      categoryId: tx.categoryId,
      statusKind: tx.statusKind,
      ruleId: tx.ruleId,
      ruleGroupId: tx.ruleGroupId,
      updatedAt: tx.updatedAt,
      cipherPayload,
      iv,
    };
  }

  private async toDomain(record: StoredTransactionRecord): Promise<Transaction> {
    const fields = await this.crypto.decrypt<EncryptedTransactionFields>(record.cipherPayload, record.iv);
    return {
      id: record.id,
      monthKey: record.monthKey,
      year: record.year,
      categoryId: record.categoryId,
      statusKind: record.statusKind,
      ruleId: record.ruleId,
      ruleGroupId: record.ruleGroupId,
      updatedAt: record.updatedAt,
      ...fields,
    };
  }
}
