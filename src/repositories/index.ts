// Composition root (architecture.md §5): the one place that decides which concrete
// repository implementation backs each domain interface. Services import from here,
// never from repositories/dexie/* directly — swapping Dexie for Firestore later, or
// adding/removing the encryption decorator, changes only this file.

import { cryptoService } from '../services/CryptoService';
import { DexieFiscalYearSummaryRepository } from './dexie/DexieFiscalYearSummaryRepository';
import { DexieMetadataRepository } from './dexie/DexieMetadataRepository';
import { DexieRuleRepository } from './dexie/DexieRuleRepository';
import { DexieTransactionRepository } from './dexie/DexieTransactionRepository';
import { EncryptingFiscalYearSummaryRepository } from './dexie/encrypting/EncryptingFiscalYearSummaryRepository';
import { EncryptingRuleRepository } from './dexie/encrypting/EncryptingRuleRepository';
import { EncryptingTransactionRepository } from './dexie/encrypting/EncryptingTransactionRepository';
import type { FiscalYearSummaryRepository } from './interfaces/FiscalYearSummaryRepository';
import type { MetadataRepository } from './interfaces/MetadataRepository';
import type { RuleRepository } from './interfaces/RuleRepository';
import type { TransactionRepository } from './interfaces/TransactionRepository';

export const transactionRepository: TransactionRepository = new EncryptingTransactionRepository(
  new DexieTransactionRepository(),
  cryptoService,
);

export const ruleRepository: RuleRepository = new EncryptingRuleRepository(
  new DexieRuleRepository(),
  cryptoService,
);

export const metadataRepository: MetadataRepository = new DexieMetadataRepository();

export const fiscalYearSummaryRepository: FiscalYearSummaryRepository = new EncryptingFiscalYearSummaryRepository(
  new DexieFiscalYearSummaryRepository(),
  cryptoService,
);
