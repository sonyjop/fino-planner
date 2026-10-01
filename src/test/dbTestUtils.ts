import { beforeAll, beforeEach } from 'vitest';
import { db } from '../repositories/dexie/db';
import { cryptoService } from '../services/CryptoService';

/**
 * Call at the top of a service-layer test file (before any `describe`). Unlocks
 * CryptoService once for the whole file (PBKDF2 is deliberately slow — no need to repeat
 * it per test) and clears every Dexie table before each test so tests don't leak state.
 */
export function setUpTestDatabase(): void {
  beforeAll(async () => {
    if (!cryptoService.isUnlocked) {
      await cryptoService.setUpPassphrase('test-passphrase-not-for-real-use');
    }
  });

  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.rules.clear(),
      db.metadataGroups.clear(),
      db.syncOutbox.clear(),
      db.monthCacheMeta.clear(),
      db.authConfig.clear(),
      db.fySummaries.clear(),
    ]);
  });
}
