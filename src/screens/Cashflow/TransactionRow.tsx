import { format, parseISO } from 'date-fns';
import IconBadge from '../../components/IconBadge';
import type { Transaction } from '../../models/Transaction';
import { effectiveAmount } from '../../services/BalanceService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useUiStore } from '../../stores/uiStore';
import { formatCurrency } from '../../utils/currency';
import { describeInstrument, resolveLeaf } from '../../utils/metadata';
import styles from './TransactionRow.module.css';

interface TransactionRowProps {
  transaction: Transaction;
}

export default function TransactionRow({ transaction }: TransactionRowProps) {
  const groups = useMetadataStore((s) => s.groups);
  const openSheet = useUiStore((s) => s.openSheet);

  // Only the leaves are stored; category and payment mode are derived (architecture.md §2.2).
  const subCategory = resolveLeaf(groups, transaction.subCategoryId);
  const category = subCategory?.group.key === 'category' ? subCategory.group : undefined;
  const paidWith = describeInstrument(groups, transaction.instrumentId);
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
          {category && subCategory ? `${category.name} › ${subCategory.item.label}` : 'Uncategorised'} ·{' '}
          {format(parseISO(transaction.date), 'dd MMM')}
        </div>
      </div>
      <div className={styles.amountCol}>
        <div className={`${styles.amount} ${styles[transaction.type]}`}>
          {sign} {formatCurrency(effectiveAmount(transaction))}
        </div>
        {/* Upcoming/Completed sections already convey status, so the row shows how it's paid. */}
        {paidWith && <span className={styles.instrument}>{paidWith}</span>}
      </div>
    </button>
  );
}
