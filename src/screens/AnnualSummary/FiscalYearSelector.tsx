import Icon from '../../components/Icon';
import { useAnnualSummaryStore } from '../../stores/annualSummaryStore';
import { fiscalYearLabel } from '../../utils/date';
import styles from './FiscalYearSelector.module.css';

export default function FiscalYearSelector() {
  const fyStartYear = useAnnualSummaryStore((s) => s.fyStartYear);
  const go = useAnnualSummaryStore((s) => s.go);

  return (
    <div className={styles.selector}>
      <button className={styles.navButton} onClick={() => go(-1)} aria-label="Previous year">
        <Icon name="chevronLeft" />
      </button>
      <span className={styles.label}>{fiscalYearLabel(fyStartYear)}</span>
      <button className={styles.navButton} onClick={() => go(1)} aria-label="Next year">
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}
