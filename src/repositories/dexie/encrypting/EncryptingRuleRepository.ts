import type { RecurringRule } from '../../../models/RecurringRule';
import type { CryptoService } from '../../../services/CryptoService';
import type { RuleRepository } from '../../interfaces/RuleRepository';
import type { DexieRuleRepository } from '../DexieRuleRepository';
import type { StoredRuleRecord } from '../StoredRecords';

/** The fields that get encrypted into `cipherPayload` — everything not needed for a Dexie index. */
type EncryptedRuleFields = Pick<
  RecurringRule,
  | 'name'
  | 'description'
  | 'type'
  | 'amount'
  | 'repeats'
  | 'dayOfMonth'
  | 'dayOfWeek'
  | 'monthOfYear'
  | 'startDate'
  | 'effectiveTo'
  | 'supersedesId'
  | 'createdAt'
>;

/**
 * Implements the domain RuleRepository by wrapping the raw Dexie CRUD layer with
 * encrypt-before-write / decrypt-after-read (architecture.md §8.3). Services only
 * ever see this — never DexieRuleRepository directly. Save is insert-only, mirroring
 * the immutable/versioned rule model (models/RecurringRule.ts).
 */
export class EncryptingRuleRepository implements RuleRepository {
  constructor(
    private readonly raw: DexieRuleRepository,
    private readonly crypto: CryptoService,
  ) {}

  async getAll(): Promise<RecurringRule[]> {
    const records = await this.raw.getAll();
    return Promise.all(records.map((r) => this.toDomain(r)));
  }

  async getById(id: string): Promise<RecurringRule | undefined> {
    const record = await this.raw.getById(id);
    return record ? this.toDomain(record) : undefined;
  }

  async getByRuleGroupId(ruleGroupId: string): Promise<RecurringRule[]> {
    const records = await this.raw.getByRuleGroupId(ruleGroupId);
    return Promise.all(records.map((r) => this.toDomain(r)));
  }

  async getActiveVersionAt(ruleGroupId: string, atDate: string): Promise<RecurringRule | undefined> {
    const versions = await this.getByRuleGroupId(ruleGroupId);
    return versions.find((v) => v.effectiveFrom <= atDate && (!v.effectiveTo || v.effectiveTo > atDate));
  }

  async save(rule: RecurringRule): Promise<void> {
    await this.raw.save(await this.toStored(rule));
  }

  async delete(id: string): Promise<void> {
    await this.raw.delete(id);
  }

  private async toStored(rule: RecurringRule): Promise<StoredRuleRecord> {
    const encryptedFields: EncryptedRuleFields = {
      name: rule.name,
      description: rule.description,
      type: rule.type,
      amount: rule.amount,
      repeats: rule.repeats,
      dayOfMonth: rule.dayOfMonth,
      dayOfWeek: rule.dayOfWeek,
      monthOfYear: rule.monthOfYear,
      startDate: rule.startDate,
      effectiveTo: rule.effectiveTo,
      supersedesId: rule.supersedesId,
      createdAt: rule.createdAt,
    };
    const { cipherPayload, iv } = await this.crypto.encrypt(encryptedFields);
    return {
      id: rule.id,
      ruleGroupId: rule.ruleGroupId,
      version: rule.version,
      categoryId: rule.categoryId,
      status: rule.status,
      effectiveFrom: rule.effectiveFrom,
      updatedAt: rule.updatedAt,
      cipherPayload,
      iv,
    };
  }

  private async toDomain(record: StoredRuleRecord): Promise<RecurringRule> {
    const fields = await this.crypto.decrypt<EncryptedRuleFields>(record.cipherPayload, record.iv);
    return {
      id: record.id,
      ruleGroupId: record.ruleGroupId,
      version: record.version,
      categoryId: record.categoryId,
      status: record.status,
      effectiveFrom: record.effectiveFrom,
      updatedAt: record.updatedAt,
      ...fields,
    };
  }
}
