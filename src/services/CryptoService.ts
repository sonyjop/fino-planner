// Key derivation & encrypt/decrypt primitives — architecture.md §8.2.
// The derived data key lives only in memory for the session; it is never persisted.

const PBKDF2_ITERATIONS = 210_000;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importPassphraseKey(passphrase: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveBits',
  ]);
}

/** `info` separates the verification hash and the data key so one can't be derived from the other. */
async function deriveBits(
  passphrase: string,
  salt: Uint8Array,
  info: string,
  bitLength: number,
): Promise<ArrayBuffer> {
  const keyMaterial = await importPassphraseKey(passphrase);
  const saltWithInfo = new Uint8Array([...salt, ...new TextEncoder().encode(info)]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltWithInfo, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    bitLength,
  );
}

export class CryptoService {
  private dataKey: CryptoKey | null = null;

  get isUnlocked(): boolean {
    return this.dataKey !== null;
  }

  /** First run: generates a salt, derives + holds the session key, returns what to persist. */
  async setUpPassphrase(passphrase: string): Promise<{ salt: string; verificationHash: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verificationBits = await deriveBits(passphrase, salt, 'verify', 256);
    const dataKeyBits = await deriveBits(passphrase, salt, 'data', 256);
    this.dataKey = await crypto.subtle.importKey('raw', dataKeyBits, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    return { salt: toBase64(salt), verificationHash: toBase64(verificationBits) };
  }

  /** Returning session: verifies against the stored hash, then derives + holds the session key. */
  async unlock(passphrase: string, storedSalt: string, storedVerificationHash: string): Promise<boolean> {
    const salt = fromBase64(storedSalt);
    const verificationBits = await deriveBits(passphrase, salt, 'verify', 256);
    if (toBase64(verificationBits) !== storedVerificationHash) return false;

    const dataKeyBits = await deriveBits(passphrase, salt, 'data', 256);
    this.dataKey = await crypto.subtle.importKey('raw', dataKeyBits, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    return true;
  }

  lock(): void {
    this.dataKey = null;
  }

  async encrypt(plainObject: unknown): Promise<{ cipherPayload: string; iv: string }> {
    if (!this.dataKey) throw new Error('CryptoService is locked — call unlock() first');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.dataKey,
      new TextEncoder().encode(JSON.stringify(plainObject)),
    );
    return { cipherPayload: toBase64(ciphertext), iv: toBase64(iv) };
  }

  async decrypt<T>(cipherPayload: string, iv: string): Promise<T> {
    if (!this.dataKey) throw new Error('CryptoService is locked — call unlock() first');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      this.dataKey,
      fromBase64(cipherPayload),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }
}

export const cryptoService = new CryptoService();
