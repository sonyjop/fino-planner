import styles from './TotalCategoriesCard.module.css';

export default function TotalCategoriesCard({ count }: { count: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>Total categories</div>
      <div className={styles.count} data-testid="total-categories">
        {count}
      </div>
    </div>
  );
}
