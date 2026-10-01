import { useEffect, useState, type FormEvent } from 'react';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import GroupedSelectField from '../../components/GroupedSelectField';
import formFieldStyles from '../../components/FormField.module.css';
import ToggleGroup from '../../components/ToggleGroup';
import type { TransactionType } from '../../models/common';
import type { RecurringRule } from '../../models/RecurringRule';
import type { TransactionStatusKind } from '../../models/Transaction';
import { RuleService } from '../../services/RuleService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { todayDateString } from '../../utils/date';
import { leafOptions, pickableLeaves } from '../../utils/metadata';
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

  const isTransactionSheet = activeSheet?.type === 'transaction';
  const existing =
    isTransactionSheet && activeSheet.mode === 'edit'
      ? transactions.find((tx) => tx.id === activeSheet.targetId)
      : undefined;

  const [title, setTitle] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(todayDateString());
  const [notes, setNotes] = useState('');
  const [statusKind, setStatusKind] = useState<TransactionStatusKind>('planned');
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
      setPlannedAmount(String(existing.plannedAmount));
      setActualAmount(existing.actualAmount !== undefined ? String(existing.actualAmount) : '');
      setSubCategoryId(existing.subCategoryId);
      // A virtual occurrence carries its rule's instrument — pre-filled, changeable for this one only.
      setInstrumentId(existing.instrumentId ?? '');
      setType(existing.type);
      setDate(existing.date);
      setNotes(existing.notes ?? '');
      setStatusKind(existing.statusKind);
    } else {
      setTitle('');
      setPlannedAmount('');
      setActualAmount('');
      setSubCategoryId(pickableLeaves(groups, 'category')[0]?.items[0]?.id ?? '');
      setInstrumentId('');
      setType('expense');
      setDate(todayDateString());
      setNotes('');
      setStatusKind('planned');
    }
    // Re-seed the form whenever a different sheet target opens — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransactionSheet, activeSheet && 'targetId' in activeSheet ? activeSheet.targetId : undefined]);

  if (!isTransactionSheet) return null;

  // transactions.feature: a brand-new entry saved straight as Completed was never planned
  // (planned = 0), so it only asks for what was paid. Anything that was planned first shows
  // both amounts once completed, with actual pre-filled from planned.
  const isUnplannedCompletion = !existing && statusKind === 'actual';
  const showsBothAmounts = statusKind === 'actual' && !isUnplannedCompletion;

  function handleStatusChange(next: TransactionStatusKind) {
    if (next === 'actual' && actualAmount === '') setActualAmount(plannedAmount);
    // A new entry typed while Completed keeps its value when switched back to Planned.
    if (next === 'planned' && !existing && plannedAmount === '') setPlannedAmount(actualAmount);
    setStatusKind(next);
  }

  // basic-usecases.txt Cashflow #7 — statusKind is a free toggle, not a one-way "mark as
  // paid". Status is a fixed Planned/Completed pair; there is no separate label (master-data.feature).
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
      plannedAmount: Number(plannedAmount || 0),
      actualAmount: statusKind === 'actual' ? Number(actualAmount || 0) : undefined,
      type,
      subCategoryId,
      instrumentId: instrumentId || undefined,
      date,
      notes: notes || undefined,
      statusKind,
    };
    try {
      if (isVirtual) {
        // No real row exists yet — completing it creates one for the first time.
        await create({ ...input, ruleId: existing!.ruleId, ruleGroupId: existing!.ruleGroupId });
      } else if (existing) {
        await update(existing.id, input);
      } else {
        await create(input);
      }
      closeSheet();
    } catch {
      setError('Couldn’t save — please try again.');
    } finally {
      setSubmitting(false);
    }
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

        {showsBothAmounts ? (
          <>
            <FormField label="Planned amount">
              <input
                className={formFieldStyles.input}
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
                placeholder="Enter planned amount"
                required
              />
            </FormField>
            <FormField label="Actual amount">
              <input
                className={formFieldStyles.input}
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder="Enter actual amount"
                required
              />
            </FormField>
          </>
        ) : (
          <FormField label="Amount">
            <input
              className={formFieldStyles.input}
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={isUnplannedCompletion ? actualAmount : plannedAmount}
              onChange={(e) => (isUnplannedCompletion ? setActualAmount : setPlannedAmount)(e.target.value)}
              placeholder="Enter amount"
              required
            />
          </FormField>
        )}

        <FormField label="Sub-category">
          <GroupedSelectField
            value={subCategoryId}
            onChange={setSubCategoryId}
            groups={leafOptions(groups, 'category', existing?.subCategoryId)}
            placeholder="Select sub-category"
            required
            aria-label="Sub-category"
          />
        </FormField>

        <FormField label="Paid with (optional)">
          <GroupedSelectField
            value={instrumentId}
            onChange={setInstrumentId}
            groups={leafOptions(groups, 'paymentMode', existing?.instrumentId)}
            placeholder="None"
            aria-label="Paid with"
          />
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
            onChange={handleStatusChange}
          />
        </FormField>

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

        <Button type="submit" disabled={submitting || !subCategoryId}>
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
