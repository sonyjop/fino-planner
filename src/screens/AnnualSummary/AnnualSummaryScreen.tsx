import { useEffect, useMemo } from 'react';
import { useAnnualSummaryStore } from '../../stores/annualSummaryStore';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { buildCategorySection, yearTotals } from '../../utils/annualSummary';
import { toMonthKey } from '../../utils/date';
import AnnualTotalsCard from './AnnualTotalsCard';
import styles from './AnnualSummaryScreen.module.css';
import CategoryBreakdownTable from './CategoryBreakdownTable';
import FiscalYearSelector from './FiscalYearSelector';
import MonthlyBreakdownTable from './MonthlyBreakdownTable';

export default function AnnualSummaryScreen() {
  const summary = useAnnualSummaryStore((s) => s.summary);
  const fyStartYear = useAnnualSummaryStore((s) => s.fyStartYear);
  const load = useAnnualSummaryStore((s) => s.load);
  const groups = useMetadataStore((s) => s.groups);
  const loadMonth = useTransactionStore((s) => s.loadMonth);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  useEffect(() => {
    // Re-read whichever FY was already selected (kept in the store across tab switches) —
    // the stored document is kept current by FiscalYearSummaryService on every write.
    load(useAnnualSummaryStore.getState().fyStartYear);
  }, [load]);

  const totals = useMemo(() => (summary ? yearTotals(summary) : null), [summary]);
  const sections = useMemo(
    () =>
      summary
        ? [buildCategorySection(summary, groups, 'income'), buildCategorySection(summary, groups, 'expense')]
        : [],
    [summary, groups],
  );

  function openMonth(year: number, month: number) {
    loadMonth(year, month);
    setActiveTab('cashflow');
  }

  const showing = summary && summary.fyStartYear === fyStartYear ? summary : null;

  return (
    <div className={styles.screen}>
      <h1>Annual Summary</h1>
      <p className={styles.subtitle}>Planned vs committed, April to March</p>

      <FiscalYearSelector />

      {showing && totals ? (
        <>
          <AnnualTotalsCard income={totals.income} expense={totals.expense} />

          <h2 className={styles.sectionTitle}>Month by month</h2>
          <MonthlyBreakdownTable
            months={showing.months}
            totals={totals}
            currentMonthKey={toMonthKey(new Date())}
            onSelectMonth={openMonth}
          />

          <h2 className={styles.sectionTitle}>By category</h2>
          <CategoryBreakdownTable sections={sections} />
        </>
      ) : (
        <p className={styles.loading}>Loading…</p>
      )}
    </div>
  );
}
