import { useEffect } from 'react';
import Icon from '../../components/Icon';
import ScrollableList from '../../components/ScrollableList';
import SummaryCard from '../../components/SummaryCard';
import { summarizeTransactions } from '../../services/BalanceService';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import styles from './CashflowScreen.module.css';
import MonthSelector from './MonthSelector';
import ProjectedBalanceCard from './ProjectedBalanceCard';
import TransactionRow from './TransactionRow';

export default function CashflowScreen() {
  const transactions = useTransactionStore((s) => s.transactions);
  const loadMonth = useTransactionStore((s) => s.loadMonth);
  const openSheet = useUiStore((s) => s.openSheet);

  useEffect(() => {
    // Refresh whichever month was already selected (persists across tab switches, since this
    // screen unmounts/remounts every time you leave and return to the Cashflow tab) — not the
    // real current month. Re-running materialization here also picks up rule edits made while
    // you were on a different tab. The store's own initial state already defaults to "now" for
    // a genuinely first-ever load, so nothing special is needed for that case.
    const { year, month } = useTransactionStore.getState();
    loadMonth(year, month);
  }, [loadMonth]);

  const summary = summarizeTransactions(transactions);
  const upcoming = transactions
    .filter((tx) => tx.statusKind === 'planned')
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = transactions
    .filter((tx) => tx.statusKind === 'actual')
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.screen}>
      <h1>Cashflow</h1>
      <p className={styles.subtitle}>Plan ahead, stay in control</p>

      <MonthSelector />
      <ProjectedBalanceCard amount={summary.projectedBalance} />

      <div className={styles.summaryRow}>
        <SummaryCard
          title="Income"
          tone="income"
          actual={summary.income.actual}
          planned={summary.income.total}
        />
        <SummaryCard
          title="Expenses"
          tone="expense"
          actual={summary.expenses.actual}
          planned={summary.expenses.total}
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className={styles.empty}>Nothing planned yet this month.</p>
        ) : (
          <ScrollableList>
            {upcoming.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </ScrollableList>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Completed</h2>
        {completed.length === 0 ? (
          <p className={styles.empty}>Nothing completed yet this month.</p>
        ) : (
          <ScrollableList>
            {completed.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </ScrollableList>
        )}
      </div>

      <button
        className={styles.fab}
        onClick={() => openSheet({ type: 'transaction', mode: 'create' })}
        aria-label="Add transaction"
      >
        <Icon name="plus" size={24} />
      </button>
    </div>
  );
}
