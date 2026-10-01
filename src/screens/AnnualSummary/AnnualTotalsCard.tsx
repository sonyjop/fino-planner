import Card from '../../components/Card';
import type { PlannedCommitted } from '../../models/FiscalYearSummary';
import Amount from './Amount';
import styles from './AnnualTotalsCard.module.css';

interface AnnualTotalsCardProps {
  income: PlannedCommitted;
  expense: PlannedCommitted;
}

export default function AnnualTotalsCard({ income, expense }: AnnualTotalsCardProps) {
  return (
    <Card className={styles.card}>
      <table className={styles.table} aria-label="Yearly totals">
        <thead>
          <tr>
            <th />
            <th>Planned</th>
            <th>Committed</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className={styles.income}>Income</th>
            <td><Amount value={income.planned} /></td>
            <td><Amount value={income.committed} /></td>
          </tr>
          <tr>
            <th className={styles.expense}>Expense</th>
            <td><Amount value={expense.planned} /></td>
            <td><Amount value={expense.committed} /></td>
          </tr>
          <tr className={styles.net}>
            <th>Net</th>
            <td><Amount value={income.planned - expense.planned} signed /></td>
            <td><Amount value={income.committed - expense.committed} signed /></td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}
