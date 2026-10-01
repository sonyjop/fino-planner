import type { FiscalYearSummary } from '../../../models/FiscalYearSummary';
import type { CryptoService } from '../../../services/CryptoService';
import type { FiscalYearSummaryRepository } from '../../interfaces/FiscalYearSummaryRepository';
import type { DexieFiscalYearSummaryRepository } from '../DexieFiscalYearSummaryRepository';
import type { StoredFiscalYearSummaryRecord } from '../StoredRecords';

/** Every monetary figure is encrypted — the same at-rest guarantee as transactions (architecture.md §8.1). */
type EncryptedSummaryFields = Pick<FiscalYearSummary, 'months' | 'categories'>;

export class EncryptingFiscalYearSummaryRepository implements FiscalYearSummaryRepository {
  constructor(
    private readonly raw: DexieFiscalYearSummaryRepository,
    private readonly crypto: CryptoService,
  ) {}

  async get(fyStartYear: number): Promise<FiscalYearSummary | undefined> {
    const record = await this.raw.get(fyStartYear);
    return record ? this.toDomain(record) : undefined;
  }

  async listFiscalYears(): Promise<number[]> {
    return this.raw.listFiscalYears();
  }

  async save(summary: FiscalYearSummary): Promise<void> {
    const encryptedFields: EncryptedSummaryFields = { months: summary.months, categories: summary.categories };
    const { cipherPayload, iv } = await this.crypto.encrypt(encryptedFields);
    await this.raw.save({ fyStartYear: summary.fyStartYear, updatedAt: summary.updatedAt, cipherPayload, iv });
  }

  private async toDomain(record: StoredFiscalYearSummaryRecord): Promise<FiscalYearSummary> {
    const fields = await this.crypto.decrypt<EncryptedSummaryFields>(record.cipherPayload, record.iv);
    return { fyStartYear: record.fyStartYear, updatedAt: record.updatedAt, ...fields };
  }
}
