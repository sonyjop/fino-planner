import { useEffect, useState, type FormEvent } from 'react';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import formFieldStyles from '../../components/FormField.module.css';
import Icon from '../../components/Icon';
import type { MetadataItem } from '../../models/MetadataGroup';
import { MetadataValidationError } from '../../services/MetadataService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useUiStore } from '../../stores/uiStore';
import styles from './MasterDataSheet.module.css';

const ICONS = ['house', 'wallet', 'basket', 'car', 'shield', 'sparkle', 'card', 'bank', 'tag'];
const COLORS = ['#3355ee', '#1a9e5c', '#e8792b', '#c9a227', '#d6336c', '#7048e8', '#0c8599', '#6b7280'];

function errorMessage(error: unknown): string {
  return error instanceof MetadataValidationError ? error.message : 'Something went wrong — please try again';
}

interface SubCategoryRowProps {
  item: MetadataItem;
  onNotice: (message: string) => void;
}

function SubCategoryRow({ item, onNotice }: SubCategoryRowProps) {
  const updateItem = useMetadataStore((s) => s.updateItem);
  const removeItem = useMetadataStore((s) => s.removeItem);
  const restoreItem = useMetadataStore((s) => s.restoreItem);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await updateItem(item.id, { label });
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // master-data.feature: used -> archive straight away; never used -> confirm a permanent delete.
  async function remove() {
    if (!item.firstUsedAt && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const outcome = await removeItem(item.id);
    setConfirmingDelete(false);
    if (outcome === 'archived') onNotice(`“${item.label}” is in use — archived, not deleted`);
  }

  if (item.archived) {
    return (
      <li className={`${styles.itemRow} ${styles.archived}`}>
        <span className={styles.itemLabel}>{item.label}</span>
        <button type="button" className={styles.linkButton} onClick={() => restoreItem(item.id)}>
          Restore
        </button>
      </li>
    );
  }

  return (
    <li className={styles.itemRow}>
      {editing ? (
        <>
          <input
            className={formFieldStyles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label={`Rename ${item.label}`}
            autoFocus
          />
          <button type="button" className={styles.linkButton} onClick={save}>
            Save
          </button>
        </>
      ) : (
        <>
          <span className={styles.itemLabel}>{item.label}</span>
          <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
            Rename
          </button>
          <button type="button" className={styles.dangerLink} onClick={remove}>
            {confirmingDelete ? 'Delete permanently' : 'Remove'}
          </button>
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}

export default function CategoryFormSheet() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  const closeSheet = useUiStore((s) => s.closeSheet);
  const openSheet = useUiStore((s) => s.openSheet);
  const groups = useMetadataStore((s) => s.groups);
  const createCategory = useMetadataStore((s) => s.createCategory);
  const updateCategory = useMetadataStore((s) => s.updateCategory);
  const removeCategory = useMetadataStore((s) => s.removeCategory);
  const restoreCategory = useMetadataStore((s) => s.restoreCategory);
  const addItem = useMetadataStore((s) => s.addItem);

  const isCategorySheet = activeSheet?.type === 'category';
  const existing =
    isCategorySheet && activeSheet.mode === 'edit' ? groups.find((g) => g.id === activeSheet.targetId) : undefined;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isCategorySheet) return;
    setName(existing?.name ?? '');
    setIcon(existing?.icon ?? ICONS[0]);
    setColor(existing?.color ?? COLORS[0]);
    setNewItem('');
    setError(null);
    setItemError(null);
    setNotice(null);
    setConfirmingDelete(false);
    // Re-seed only when a different category opens, not when the store refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCategorySheet, activeSheet?.targetId]);

  if (!isCategorySheet) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (existing) {
        await updateCategory(existing.id, { name, icon, color });
        closeSheet();
      } else {
        // Stay open on the new category so its first sub-categories can be added straight away.
        const created = await createCategory({ name, icon, color });
        openSheet({ type: 'category', mode: 'edit', targetId: created.id });
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleAddItem() {
    if (!existing) return;
    setItemError(null);
    try {
      await addItem(existing.id, { label: newItem });
      setNewItem('');
    } catch (e) {
      setItemError(errorMessage(e));
    }
  }

  async function handleRemoveCategory() {
    if (!existing) return;
    if (!existing.firstUsedAt && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const outcome = await removeCategory(existing.id);
    if (outcome === 'deleted') closeSheet();
    else setNotice(`“${existing.name}” is in use — archived with its sub-categories, not deleted`);
    setConfirmingDelete(false);
  }

  const items = [...(existing?.items ?? [])].sort((a, b) => a.order - b.order);
  const activeItems = items.filter((i) => !i.archived);
  const archivedItems = items.filter((i) => i.archived);

  return (
    <BottomSheet title={existing ? existing.name : 'Add category'} onClose={closeSheet}>
      {notice && <p className={styles.notice}>{notice}</p>}
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormField label="Name">
          <input
            className={formFieldStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Education"
            required
          />
        </FormField>

        <FormField label="Icon">
          <div className={styles.choices} role="radiogroup" aria-label="Icon">
            {ICONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={icon === option}
                aria-label={option}
                className={icon === option ? `${styles.choice} ${styles.choiceSelected}` : styles.choice}
                onClick={() => setIcon(option)}
              >
                <Icon name={option} />
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Colour">
          <div className={styles.choices} role="radiogroup" aria-label="Colour">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={option}
                className={color === option ? `${styles.swatch} ${styles.choiceSelected}` : styles.swatch}
                style={{ background: option }}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </FormField>

        {error && <p className={styles.error}>{error}</p>}

        {!existing?.archived && <Button type="submit">{existing ? 'Save changes' : 'Create category'}</Button>}
      </form>

      {existing && !existing.archived && (
        <section className={styles.items}>
          <h3 className={styles.itemsTitle}>Sub-categories</h3>
          {activeItems.length === 0 && (
            <p className={styles.hint}>Add a sub-category — until then this category can’t be picked.</p>
          )}
          <ul className={styles.itemList}>
            {activeItems.map((item) => (
              <SubCategoryRow key={item.id} item={item} onNotice={setNotice} />
            ))}
          </ul>
          <div className={styles.addRow}>
            <input
              className={formFieldStyles.input}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="New sub-category"
              aria-label="New sub-category"
            />
            <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!newItem.trim()}>
              Add
            </Button>
          </div>
          {itemError && <p className={styles.error}>{itemError}</p>}

          {archivedItems.length > 0 && (
            <>
              <h3 className={styles.itemsTitle}>Archived</h3>
              <ul className={styles.itemList}>
                {archivedItems.map((item) => (
                  <SubCategoryRow key={item.id} item={item} onNotice={setNotice} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {existing && (
        <div className={styles.footer}>
          {existing.archived ? (
            <Button type="button" variant="secondary" onClick={() => restoreCategory(existing.id)}>
              Restore category
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={handleRemoveCategory}>
              {confirmingDelete ? 'Delete permanently' : 'Remove category'}
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
