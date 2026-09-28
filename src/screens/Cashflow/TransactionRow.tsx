import { format, parseISO } from 'date-fns';
import IconBadge from '../../components/IconBadge';
import Pill, { type PillTone } from '../../components/Pill';
import type { Transaction } from '../../models/Transaction';
import { useMetadataStore } from '../../stores/metadataStore';
import { useUiStore } from '../../stores/uiStore';
import { formatCurrency } from '../../utils/currency';
import { findCategoryGroup, resolveItemLabel } from '../../utils/metadata';
import styles from './TransactionRow.module.css';

/** Seed status labels map to tones directly; anything custom falls back to 'planned'. */
function toneForLabel(label: string | undefined): PillTone {
  const key = label?.toLowerCase();
  if (key === 'paid') return 'paid';
  if (key === 'partial') return 'partial';
  return 'planned';
}

interface TransactionRowProps {
  transaction: Transaction;
}

export default function TransactionRow({ transaction }: TransactionRowProps) {
  const groups = useMetadataStore((s) => s.groups);
  const openSheet = useUiStore((s) => s.openSheet);

  const category = findCategoryGroup(groups, transaction.categoryId);
  const statusLabel = resolveItemLabel(groups, 'status', transaction.statusLabelId);
  const sign = transaction.type === 'income' ? '+' : '−';

  return (
    <button
      className={styles.row}
      onClick={() => openSheet({ type: 'transaction', mode: 'edit', targetId: transaction.id })}
    >
      <IconBadge icon={category?.icon ?? 'tag'} color={category?.color ?? '#6b7280'} />
      <div className={styles.body}>
        <div className={styles.title}>{transaction.title}</div>
        <div className={styles.subtitle}>
          {category?.name ?? 'Uncategorized'} · {format(parseISO(transaction.date), 'dd MMM')}
        </div>
      </div>
      <div className={styles.amountCol}>
        <div className={`${styles.amount} ${styles[transaction.type]}`}>
          {sign} {formatCurrency(transaction.amount)}
        </div>
        {statusLabel && <Pill tone={toneForLabel(statusLabel)}>{statusLabel}</Pill>}
      </div>
    </button>
  );
}
