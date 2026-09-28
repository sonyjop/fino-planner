import { useEffect, useState, type FormEvent } from 'react';
import { APP_NAME } from '../../config/app';
import { AuthService } from '../../services/AuthService';
import styles from './UnlockScreen.module.css';

type Mode = 'loading' | 'setup' | 'unlock';

export default function UnlockScreen() {
  const [mode, setMode] = useState<Mode>('loading');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AuthService.hasPassphraseSet().then((has) => setMode(has ? 'unlock' : 'setup'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === 'setup') {
      if (passphrase.length < 8) {
        setError('Use at least 8 characters.');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setError('Passphrases do not match.');
        return;
      }
      setSubmitting(true);
      await AuthService.setUpPassphrase(passphrase);
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    const ok = await AuthService.unlock(passphrase);
    setSubmitting(false);
    if (!ok) {
      setError('Incorrect passphrase.');
      setPassphrase('');
    }
  }

  if (mode === 'loading') return null;

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.subtitle}>
          {mode === 'setup'
            ? 'Set a passphrase to secure your data on this device.'
            : 'Enter your passphrase to continue.'}
        </p>

        <input
          className={styles.input}
          type="password"
          placeholder="Passphrase"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />

        {mode === 'setup' && (
          <input
            className={styles.input}
            type="password"
            placeholder="Confirm passphrase"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
          />
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.button} type="submit" disabled={submitting || !passphrase}>
          {mode === 'setup' ? 'Create passphrase' : 'Unlock'}
        </button>

        {mode === 'setup' && (
          <p className={styles.hint}>
            There is no recovery for this passphrase — losing it means losing locally stored data.
          </p>
        )}
      </form>
    </div>
  );
}
