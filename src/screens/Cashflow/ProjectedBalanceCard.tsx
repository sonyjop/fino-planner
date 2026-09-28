import { formatCurrency } from '../../utils/currency';
import styles from './ProjectedBalanceCard.module.css';

interface ProjectedBalanceCardProps {
  amount: number;
}

export default function ProjectedBalanceCard({ amount }: ProjectedBalanceCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>Projected Balance</div>
      <div className={styles.amount}>{formatCurrency(amount)}</div>
      <div className={styles.subtitle}>after all planned transactions</div>
    </div>
  );
}
