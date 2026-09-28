import { useEffect, useState } from 'react';
import type { RecurringRule } from '../../models/RecurringRule';
import { RuleEngineService } from '../../services/RuleEngineService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useUiStore } from '../../stores/uiStore';
import { findCategoryGroup } from '../../utils/metadata';
import { formatCurrency } from '../../utils/currency';
import { describeSchedule, formatDate } from '../../utils/rule';
import styles from './RuleRow.module.css';

const STATUS_LABEL: Record<RecurringRule['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  deprecated: 'Deprecated',
  expired: 'Expired',
};

const STATUS_CLASS: Record<RecurringRule['status'], string> = {
  active: styles.statusActive,
  paused: styles.statusPaused,
  cancelled: styles.statusCancelled,
  deprecated: styles.statusDeprecated,
  expired: styles.statusExpired,
};

interface RuleRowProps {
  rule: RecurringRule;
}

export default function RuleRow({ rule }: RuleRowProps) {
  const groups = useMetadataStore((s) => s.groups);
  const openSheet = useUiStore((s) => s.openSheet);
  const category = findCategoryGroup(groups, rule.categoryId);
  const [execution, setExecution] = useState<{ lastExecutedDate?: string; nextDueDate?: string }>({});

  useEffect(() => {
    RuleEngineService.getExecutionInfo(rule).then(setExecution);
  }, [rule]);

  return (
    <button
      className={styles.row}
      onClick={() => openSheet({ type: 'rule', mode: 'edit', targetId: rule.ruleGroupId })}
    >
      <div className={styles.top}>
        <span className={styles.name}>
          {rule.name} <span className={styles.versionBadge}>v{rule.version}</span>
        </span>
        <span className={styles.amount}>{formatCurrency(rule.amount)}</span>
      </div>
      <div className={styles.subtitle}>
        {category?.name ?? 'Uncategorized'} · {describeSchedule(rule)}
      </div>
      <div className={styles.footer}>
        <span className={`${styles.statusChip} ${STATUS_CLASS[rule.status]}`}>
          <span className={styles.dot} />
          <span className={styles.statusLabel}>{STATUS_LABEL[rule.status]}</span>
        </span>
        <span className={styles.executionInfo}>
          Last: {execution.lastExecutedDate ? formatDate(execution.lastExecutedDate) : 'Never'} · Next:{' '}
          {execution.nextDueDate ? formatDate(execution.nextDueDate) : '—'}
        </span>
      </div>
    </button>
  );
}
