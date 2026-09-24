import { db } from '../repositories/dexie/db';
import { useAuthStore } from '../stores/authStore';
import { cryptoService } from './CryptoService';

export const AuthService = {
  async hasPassphraseSet(): Promise<boolean> {
    const config = await db.authConfig.get('default');
    return !!config;
  },

  async setUpPassphrase(passphrase: string): Promise<void> {
    const { salt, verificationHash } = await cryptoService.setUpPassphrase(passphrase);
    await db.authConfig.put({ id: 'default', salt, verificationHash });
    useAuthStore.getState().setUnlocked(true);
  },

  async unlock(passphrase: string): Promise<boolean> {
    const config = await db.authConfig.get('default');
    if (!config) return false;
    const ok = await cryptoService.unlock(passphrase, config.salt, config.verificationHash);
    if (ok) useAuthStore.getState().setUnlocked(true);
    return ok;
  },

  lock(): void {
    cryptoService.lock();
    useAuthStore.getState().setUnlocked(false);
  },
};
