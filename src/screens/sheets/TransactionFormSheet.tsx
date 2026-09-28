import { useEffect, useMemo, useState, type FormEvent } from 'react';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import formFieldStyles from '../../components/FormField.module.css';
import SelectField from '../../components/SelectField';
import ToggleGroup from '../../components/ToggleGroup';
import type { TransactionType } from '../../models/common';
import type { RecurringRule } from '../../models/RecurringRule';
import type { TransactionStatusKind } from '../../models/Transaction';
import { RuleService } from '../../services/RuleService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { todayDateString } from '../../utils/date';
import { findGroupByKey, getCategoryGroups, resolveItemIdByLabel } from '../../utils/metadata';
import styles from './TransactionFormSheet.module.css';

export default function TransactionFormSheet() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  const closeSheet = useUiStore((s) => s.closeSheet);
  const openSheet = useUiStore((s) => s.openSheet);
  const groups = useMetadataStore((s) => s.groups);
  const transactions = useTransactionStore((s) => s.transactions);
  const create = useTransactionStore((s) => s.create);
  const update = useTransactionStore((s) => s.update);
  const remove = useTransactionStore((s) => s.remove);

  const categoryGroups = useMemo(() => getCategoryGroups(groups), [groups]);
  const statusGroup = useMemo(() => findGroupByKey(groups, 'status'), [groups]);
  const isTransactionSheet = activeSheet?.type === 'transaction';
  const existing =
    isTransactionSheet && activeSheet.mode === 'edit'
      ? transactions.find((tx) => tx.id === activeSheet.targetId)
      : undefined;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(todayDateString());
  const [notes, setNotes] = useState('');
  const [statusKind, setStatusKind] = useState<TransactionStatusKind>('planned');
  const [statusLabelId, setStatusLabelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [originRule, setOriginRule] = useState<RecurringRule | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // A rule-derived planned occurrence is computed, not stored (architecture.md §2.5) —
  // recognizable by its synthetic id. It only becomes a real row once completed.
  const isVirtual = existing?.id.startsWith('virtual:') ?? false;

  useEffect(() => {
    if (existing?.ruleId) {
      RuleService.getVersion(existing.ruleId).then(setOriginRule);
    } else {
      setOriginRule(undefined);
    }
  }, [existing?.ruleId]);

  useEffect(() => {
    if (!isTransactionSheet) return;
    if (existing) {
      setTitle(existing.title);
      setAmount(String(existing.amount));
      setCategoryId(existing.categoryId);
      setType(existing.type);
      setDate(existing.date);
      setNotes(existing.notes ?? '');
      setStatusKind(existing.statusKind);
      setStatusLabelId(existing.statusLabelId ?? '');
    } else {
      setTitle('');
      setAmount('');
      setCategoryId(categoryGroups[0]?.id ?? '');
      setType('expense');
      setDate(todayDateString());
      setNotes('');
      setStatusKind('planned');
      setStatusLabelId('');
    }
    // Re-seed the form whenever a different sheet target opens — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransactionSheet, activeSheet && 'targetId' in activeSheet ? activeSheet.targetId : undefined]);

  if (!isTransactionSheet) return null;

  // basic-usecases.txt Cashflow #7 — statusKind is a free toggle, not a one-way "mark as
  // paid"; statusLabelId is a separate, purely cosmetic tag (defaults to match the toggle
  // unless the user picked something else, e.g. 'Partial' while still planned).
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (isVirtual && statusKind !== 'actual') {
      setError('Editing a planned occurrence isn’t supported yet — mark it Completed to save, or edit the recurring rule instead.');
      return;
    }

    setSubmitting(true);
    const input = {
      title,
      amount: Number(amount),
      type,
      categoryId,
      date,
      notes: notes || undefined,
      statusKind,
      statusLabelId:
        statusLabelId || resolveItemIdByLabel(groups, 'status', statusKind === 'actual' ? 'Paid' : 'Planned'),
    };
    if (isVirtual) {
      // No real row exists yet — completing it creates one for the first time.
      await create({ ...input, ruleId: existing!.ruleId, ruleGroupId: existing!.ruleGroupId });
    } else if (existing) {
      await update(existing.id, input);
    } else {
      await create(input);
    }
    setSubmitting(false);
    closeSheet();
  }

  async function handleDelete() {
    if (!existing) return;
    setSubmitting(true);
    await remove(existing.id);
    setSubmitting(false);
    closeSheet();
  }

  return (
    <BottomSheet title={existing ? existing.title : 'Add planned transaction'} onClose={closeSheet}>
      {originRule && (
        <button
          type="button"
          className={styles.originLink}
          onClick={() => openSheet({ type: 'rule', mode: 'edit', targetId: originRule.ruleGroupId })}
        >
          From recurring rule: {originRule.name} · v{originRule.version}
        </button>
      )}
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormField label="Title">
          <input
            className={formFieldStyles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Broadband Internet"
            required
          />
        </FormField>

        <FormField label="Amount">
          <input
            className={formFieldStyles.input}
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            required
          />
        </FormField>

        <FormField label="Category">
          <SelectField value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="" disabled>
              Select category
            </option>
            {categoryGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </SelectField>
        </FormField>

        <FormField label="Type">
          <ToggleGroup
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
            value={type}
            onChange={setType}
          />
        </FormField>

        <FormField label="Status">
          <ToggleGroup
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'actual', label: 'Completed' },
            ]}
            value={statusKind}
            onChange={setStatusKind}
          />
        </FormField>

        {statusGroup && statusGroup.items.length > 0 && (
          <FormField label="Status label (optional)">
            <SelectField value={statusLabelId} onChange={(e) => setStatusLabelId(e.target.value)}>
              <option value="">Auto ({statusKind === 'actual' ? 'Paid' : 'Planned'})</option>
              {statusGroup.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </FormField>
        )}

        <FormField label="Due Date">
          <input
            className={formFieldStyles.input}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Notes (optional)">
          <input
            className={formFieldStyles.input}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add some details..."
          />
        </FormField>

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" disabled={submitting || !categoryId}>
          {isVirtual ? 'Mark completed' : existing ? 'Save changes' : 'Add entry'}
        </Button>

        {existing && !isVirtual && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
            Delete
          </Button>
        )}
      </form>
    </BottomSheet>
  );
}
