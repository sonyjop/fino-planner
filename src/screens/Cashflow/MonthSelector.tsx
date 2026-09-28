import { format } from 'date-fns';
import type { ChangeEvent } from 'react';
import Icon from '../../components/Icon';
import { useTransactionStore } from '../../stores/transactionStore';
import { pad2 } from '../../utils/date';
import styles from './MonthSelector.module.css';

export default function MonthSelector() {
  const year = useTransactionStore((s) => s.year);
  const month = useTransactionStore((s) => s.month);
  const loadMonth = useTransactionStore((s) => s.loadMonth);

  function go(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    loadMonth(date.getFullYear(), date.getMonth() + 1);
  }

  function handlePicked(event: ChangeEvent<HTMLInputElement>) {
    // type="date", not type="month": Safari's support for month inputs is inconsistent
    // across versions (especially desktop Safari), but the date picker is reliable
    // everywhere — the day component is picked but ignored, only year/month matter.
    const [y, m] = event.target.value.split('-').map(Number);
    if (y && m) loadMonth(y, m);
  }

  return (
    <div className={styles.selector}>
      <button className={styles.navButton} onClick={() => go(-1)} aria-label="Previous month">
        <Icon name="chevronLeft" />
      </button>

      <span className={styles.labelWrapper}>
        <span className={styles.label}>{format(new Date(year, month - 1, 1), 'MMMM yyyy')}</span>
        <input
          type="date"
          className={styles.monthInput}
          value={`${year}-${pad2(month)}-01`}
          onChange={handlePicked}
          aria-label="Jump to month"
        />
      </span>

      <button className={styles.navButton} onClick={() => go(1)} aria-label="Next month">
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}
