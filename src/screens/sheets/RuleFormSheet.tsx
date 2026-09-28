import { useEffect, useMemo, useState, type FormEvent } from 'react';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import formFieldStyles from '../../components/FormField.module.css';
import SelectField from '../../components/SelectField';
import ToggleGroup from '../../components/ToggleGroup';
import type { TransactionType } from '../../models/common';
import type { RecurringRule, RuleCadence } from '../../models/RecurringRule';
import { RuleEngineService } from '../../services/RuleEngineService';
import { RuleService } from '../../services/RuleService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useRuleStore } from '../../stores/ruleStore';
import { useUiStore } from '../../stores/uiStore';
import { formatCurrency } from '../../utils/currency';
import { todayDateString } from '../../utils/date';
import { findCategoryGroup, getCategoryGroups } from '../../utils/metadata';
import { describeSchedule, formatDate } from '../../utils/rule';
import styles from './RuleFormSheet.module.css';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_TEXT: Record<RecurringRule['status'], string> = {
  active: 'Rule is active',
  paused: "Rule is paused — nothing will be planned",
  cancelled: 'Rule is cancelled',
  deprecated: 'Rule is deprecated — superseded by a newer version',
  expired: "Rule has expired — past its end date",
};

/** Pause/resume/cancel are only meaningful while a rule is still live. */
const MANAGEABLE_STATUSES: RecurringRule['status'][] = ['active', 'paused'];

export default function RuleFormSheet() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  const closeSheet = useUiStore((s) => s.closeSheet);
  const groups = useMetadataStore((s) => s.groups);
  const rules = useRuleStore((s) => s.rules);
  const create = useRuleStore((s) => s.create);
  const revise = useRuleStore((s) => s.revise);
  const setStatus = useRuleStore((s) => s.setStatus);
  const remove = useRuleStore((s) => s.remove);

  const categoryGroups = useMemo(() => getCategoryGroups(groups), [groups]);
  const isRuleSheet = activeSheet?.type === 'rule';
  const existing =
    isRuleSheet && activeSheet.mode === 'edit'
      ? rules.find((r) => r.ruleGroupId === activeSheet.targetId)
      : undefined;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [repeats, setRepeats] = useState<RuleCadence>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('1');
  const [startDate, setStartDate] = useState(todayDateString());
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateString());
  const [neverEnding, setNeverEnding] = useState(true);
  const [endDate, setEndDate] = useState(todayDateString());
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<RecurringRule[]>([]);
  const [viewingVersion, setViewingVersion] = useState<RecurringRule | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [execution, setExecution] = useState<{ lastExecutedDate?: string; nextDueDate?: string }>({});

  useEffect(() => {
    if (existing) {
      RuleService.getHistory(existing.ruleGroupId).then(setHistory);
      RuleEngineService.getExecutionInfo(existing).then(setExecution);
    } else {
      setHistory([]);
      setExecution({});
    }
    setViewingVersion(null);
    setHistoryExpanded(false);
    // Only refetch when the sheet targets a different rule lineage, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.ruleGroupId]);

  // The form above already represents the current version — history lists only past ones.
  const previousVersions = existing ? history.filter((v) => v.id !== existing.id) : [];

  useEffect(() => {
    if (!isRuleSheet) return;
    if (existing) {
      setName(existing.name);
      setAmount(String(existing.amount));
      setCategoryId(existing.categoryId);
      setType(existing.type);
      setRepeats(existing.repeats);
      setDayOfMonth(String(existing.dayOfMonth ?? 1));
      setMonthOfYear(String(existing.monthOfYear ?? 1));
      setStartDate(existing.startDate);
      setEffectiveFrom(todayDateString()); // when a revision takes effect — defaults to today, editable below
      setNeverEnding(!existing.endDate);
      setEndDate(existing.endDate ?? todayDateString());
    } else {
      setName('');
      setAmount('');
      setCategoryId(categoryGroups[0]?.id ?? '');
      setType('expense');
      setRepeats('monthly');
      setDayOfMonth('1');
      setMonthOfYear('1');
      setStartDate(todayDateString());
      setNeverEnding(true);
      setEndDate(todayDateString());
    }
    // Re-seed the form whenever a different sheet target opens — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRuleSheet, activeSheet && 'targetId' in activeSheet ? activeSheet.targetId : undefined]);

  if (!isRuleSheet) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const shared = {
      name,
      amount: Number(amount),
      type,
      categoryId,
      repeats,
      dayOfMonth: Number(dayOfMonth),
      monthOfYear: repeats === 'monthly' ? undefined : Number(monthOfYear),
      endDate: neverEnding ? undefined : endDate,
    };
    if (existing) {
      await revise(existing.ruleGroupId, { ...shared, effectiveFrom });
    } else {
      await create({ ...shared, startDate });
    }
    setSubmitting(false);
    closeSheet();
  }

  async function handleToggleStatus() {
    if (!existing) return;
    setSubmitting(true);
    await setStatus(existing.ruleGroupId, existing.status === 'active' ? 'paused' : 'active');
    setSubmitting(false);
    closeSheet();
  }

  async function handleCancel() {
    if (!existing) return;
    setSubmitting(true);
    await setStatus(existing.ruleGroupId, 'cancelled');
    setSubmitting(false);
    closeSheet();
  }

  async function handleDelete() {
    if (!existing) return;
    setSubmitting(true);
    await remove(existing.ruleGroupId);
    setSubmitting(false);
    closeSheet();
  }

  if (viewingVersion) {
    const versionCategory = findCategoryGroup(groups, viewingVersion.categoryId);
    return (
      <BottomSheet title={`Version ${viewingVersion.version} — read only`} onClose={closeSheet}>
        <button type="button" className={styles.backLink} onClick={() => setViewingVersion(null)}>
          ← Back to current version
        </button>
        <div className={styles.readOnlyDetail}>
          <div className={styles.readOnlyRow}>
            <span>Name</span>
            <span>{viewingVersion.name}</span>
          </div>
          {viewingVersion.description && (
            <div className={styles.readOnlyRow}>
              <span>Description</span>
              <span>{viewingVersion.description}</span>
            </div>
          )}
          <div className={styles.readOnlyRow}>
            <span>Type</span>
            <span>{viewingVersion.type === 'income' ? 'Income' : 'Expense'}</span>
          </div>
          <div className={styles.readOnlyRow}>
            <span>Category</span>
            <span>{versionCategory?.name ?? 'Uncategorized'}</span>
          </div>
          <div className={styles.readOnlyRow}>
            <span>Amount</span>
            <span>{formatCurrency(viewingVersion.amount)}</span>
          </div>
          <div className={styles.readOnlyRow}>
            <span>Schedule</span>
            <span>{describeSchedule(viewingVersion)}</span>
          </div>
          <div className={styles.readOnlyRow}>
            <span>Effective</span>
            <span>
              {formatDate(viewingVersion.effectiveFrom)}
              {viewingVersion.effectiveTo ? ` – ${formatDate(viewingVersion.effectiveTo)}` : ' – current'}
            </span>
          </div>
          <div className={styles.readOnlyRow}>
            <span>Status at the time</span>
            <span>{viewingVersion.status}</span>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={existing ? `Edit recurring rule · v${existing.version}` : 'Add recurring rule'}
      onClose={closeSheet}
    >
      {existing && (
        <div className={styles.statusBanner}>
          <span className={styles.statusText}>{STATUS_TEXT[existing.status]}</span>
          {MANAGEABLE_STATUSES.includes(existing.status) && (
            <Button variant="secondary" className={styles.statusActionButton} onClick={handleToggleStatus}>
              {existing.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
          )}
        </div>
      )}

      {existing && (
        <p className={styles.executionInfo}>
          Last executed: {execution.lastExecutedDate ? formatDate(execution.lastExecutedDate) : 'Never'} · Next
          due: {execution.nextDueDate ? formatDate(execution.nextDueDate) : '—'}
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <FormField label="Rule Name">
          <input
            className={formFieldStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix Subscription"
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

        <div className={styles.row}>
          <FormField label="Repeats">
            <SelectField value={repeats} onChange={(e) => setRepeats(e.target.value as RuleCadence)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </SelectField>
          </FormField>
          <FormField label="Day of Month">
            <input
              className={formFieldStyles.input}
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              required
            />
          </FormField>
        </div>

        {repeats === 'quarterly' && (
          <FormField label="Start Month (fires every 3rd month from here)">
            <SelectField value={monthOfYear} onChange={(e) => setMonthOfYear(e.target.value)}>
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </SelectField>
          </FormField>
        )}

        {repeats === 'yearly' && (
          <FormField label="Month">
            <SelectField value={monthOfYear} onChange={(e) => setMonthOfYear(e.target.value)}>
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </SelectField>
          </FormField>
        )}

        {!existing && (
          <FormField label="Start Date">
            <input
              className={formFieldStyles.input}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </FormField>
        )}

        {existing && (
          <FormField label="Effective From">
            <input
              className={formFieldStyles.input}
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </FormField>
        )}
        {existing && (
          <p className={styles.hint}>
            This save creates version {existing.version + 1}, effective from the date above. Earlier
            months already on the books keep their original terms.
          </p>
        )}

        <FormField label="Duration">
          <ToggleGroup
            options={[
              { value: 'never', label: 'Never ending' },
              { value: 'ends', label: 'Has an end date' },
            ]}
            value={neverEnding ? 'never' : 'ends'}
            onChange={(v) => setNeverEnding(v === 'never')}
          />
        </FormField>

        {!neverEnding && (
          <FormField label="End Date">
            <input
              className={formFieldStyles.input}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </FormField>
        )}

        <Button type="submit" disabled={submitting || !categoryId}>
          {existing ? 'Save rule' : 'Add rule'}
        </Button>

        {existing && (
          <>
            {MANAGEABLE_STATUSES.includes(existing.status) && (
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
                Cancel rule
              </Button>
            )}
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
              Delete rule
            </Button>
          </>
        )}
      </form>

      {existing && previousVersions.length > 0 && (
        <div className={styles.history}>
          <button
            type="button"
            className={styles.historyToggle}
            onClick={() => setHistoryExpanded((expanded) => !expanded)}
          >
            <span>{historyExpanded ? '▾' : '▸'}</span>
            <span>
              {previousVersions.length} previous version{previousVersions.length > 1 ? 's' : ''}
            </span>
          </button>
          {historyExpanded && (
            <div className={styles.historyList}>
              {[...previousVersions].reverse().map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className={styles.historyRow}
                  onClick={() => setViewingVersion(version)}
                >
                  <span>
                    v{version.version} · {formatCurrency(version.amount)}
                  </span>
                  <span>
                    {formatDate(version.effectiveFrom)}
                    {version.effectiveTo ? ` – ${formatDate(version.effectiveTo)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
