import { format } from 'date-fns';
import type { MonthTotals, PlannedCommitted } from '../../models/FiscalYearSummary';
import Amount from './Amount';
import styles from './MonthlyBreakdownTable.module.css';

interface MonthlyBreakdownTableProps {
  months: MonthTotals[];
  totals: { income: PlannedCommitted; expense: PlannedCommitted };
  /** 'YYYY-MM' of today, highlighted when it falls in this FY. */
  currentMonthKey: string;
  onSelectMonth: (year: number, month: number) => void;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return format(new Date(year, month - 1, 1), 'MMM yyyy');
}

function Figures({ income, expense }: { income: PlannedCommitted; expense: PlannedCommitted }) {
  return (
    <>
      <td><Amount value={income.planned} compact /></td>
      <td><Amount value={income.committed} compact /></td>
      <td><Amount value={expense.planned} compact /></td>
      <td><Amount value={expense.committed} compact /></td>
      <td><Amount value={income.planned - expense.planned} compact signed /></td>
      <td><Amount value={income.committed - expense.committed} compact signed /></td>
    </>
  );
}

export default function MonthlyBreakdownTable({
  months,
  totals,
  currentMonthKey,
  onSelectMonth,
}: MonthlyBreakdownTableProps) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table} aria-label="Monthwise split">
        <thead>
          <tr>
            <th rowSpan={2} className={styles.monthCol}>Month</th>
            <th colSpan={2} className={styles.income}>Income</th>
            <th colSpan={2} className={styles.expense}>Expense</th>
            <th colSpan={2}>Net</th>
          </tr>
          <tr className={styles.subHeader}>
            <th>Plan</th>
            <th>Done</th>
            <th>Plan</th>
            <th>Done</th>
            <th>Plan</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const [year, month] = m.monthKey.split('-').map(Number);
            const isCurrent = m.monthKey === currentMonthKey;
            return (
              <tr
                key={m.monthKey}
                className={isCurrent ? `${styles.row} ${styles.current}` : styles.row}
                aria-current={isCurrent ? 'date' : undefined}
                onClick={() => onSelectMonth(year, month)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMonth(year, month);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <th scope="row" className={styles.monthCol}>{monthLabel(m.monthKey)}</th>
                <Figures income={m.income} expense={m.expense} />
              </tr>
            );
          })}
          <tr className={styles.totalRow}>
            <th scope="row" className={styles.monthCol}>FY total</th>
            <Figures income={totals.income} expense={totals.expense} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
