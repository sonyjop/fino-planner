import { formatCurrency } from '../utils/currency';
import styles from './SummaryCard.module.css';

interface SummaryCardProps {
  title: string;
  actual: number;
  planned: number;
  tone: 'income' | 'expense';
}

/** Actual is the large/primary figure, Planned the small subtext — architecture.md §4 (inverted from the source PDF). */
export default function SummaryCard({ title, actual, planned, tone }: SummaryCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={`${styles.actual} ${styles[tone]}`}>{formatCurrency(actual)}</div>
      <div className={styles.planned}>Planned {formatCurrency(planned)}</div>
    </div>
  );
}
