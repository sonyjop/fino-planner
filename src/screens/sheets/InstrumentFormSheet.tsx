import { useEffect, useState, type FormEvent } from 'react';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import formFieldStyles from '../../components/FormField.module.css';
import { MetadataValidationError } from '../../services/MetadataService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useUiStore } from '../../stores/uiStore';
import { resolveLeaf } from '../../utils/metadata';
import styles from './MasterDataSheet.module.css';

export default function InstrumentFormSheet() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  const closeSheet = useUiStore((s) => s.closeSheet);
  const groups = useMetadataStore((s) => s.groups);
  const addItem = useMetadataStore((s) => s.addItem);
  const updateItem = useMetadataStore((s) => s.updateItem);
  const removeItem = useMetadataStore((s) => s.removeItem);
  const restoreItem = useMetadataStore((s) => s.restoreItem);

  const isInstrumentSheet = activeSheet?.type === 'instrument';
  const existing = isInstrumentSheet && activeSheet.mode === 'edit' ? resolveLeaf(groups, activeSheet.targetId) : undefined;
  const mode = existing?.group ?? groups.find((g) => g.id === activeSheet?.parentId);

  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isInstrumentSheet) return;
    setLabel(existing?.item.label ?? '');
    setLast4(existing?.item.last4 ?? '');
    setError(null);
    setNotice(null);
    setConfirmingDelete(false);
    // Re-seed only when a different instrument opens, not when the store refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInstrumentSheet, activeSheet?.targetId, activeSheet?.parentId]);

  if (!isInstrumentSheet || !mode) return null;

  const item = existing?.item;
  const isSystem = item?.isSystem ?? false;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (item) await updateItem(item.id, { label, last4 });
      else await addItem(mode!.id, { label, last4 });
      closeSheet();
    } catch (e) {
      setError(e instanceof MetadataValidationError ? e.message : 'Something went wrong — please try again');
    }
  }

  async function handleRemove() {
    if (!item) return;
    if (!item.firstUsedAt && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const outcome = await removeItem(item.id);
    if (outcome === 'deleted') closeSheet();
    else setNotice(`“${item.label}” is in use — archived, not deleted`);
    setConfirmingDelete(false);
  }

  return (
    <BottomSheet title={item ? `${mode.name} · ${item.label}` : `Add to ${mode.name}`} onClose={closeSheet}>
      {notice && <p className={styles.notice}>{notice}</p>}
      {isSystem && <p className={styles.hint}>“Cash” is built in and can’t be changed.</p>}
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormField label="Nickname">
          <input
            className={formFieldStyles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. HDFC Regalia"
            disabled={isSystem || item?.archived}
            required
          />
        </FormField>

        {!isSystem && (
          <FormField label="Last 4 digits (optional)">
            <input
              className={formFieldStyles.input}
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 4321"
              disabled={item?.archived}
            />
          </FormField>
        )}
        <p className={styles.hint}>Never enter a full card or account number — a nickname and the last 4 digits are enough.</p>

        {error && <p className={styles.error}>{error}</p>}

        {!isSystem && !item?.archived && <Button type="submit">{item ? 'Save changes' : 'Add instrument'}</Button>}
      </form>

      {item && !isSystem && (
        <div className={styles.footer}>
          {item.archived ? (
            <Button type="button" variant="secondary" onClick={() => restoreItem(item.id)}>
              Restore
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={handleRemove}>
              {confirmingDelete ? 'Delete permanently' : 'Remove'}
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
