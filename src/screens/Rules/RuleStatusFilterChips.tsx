import type { RuleStatus } from '../../models/RecurringRule';
import styles from './RuleStatusFilterChips.module.css';

/**
 * 'deprecated' deliberately excluded: RuleService.list() only ever returns the latest
 * version per lineage, and a deprecated row is by definition never the latest — it can
 * never appear here, only in that lineage's version history (already surfaced there).
 */
export type StatusFilter = 'all' | Exclude<RuleStatus, 'deprecated'>;

interface RuleStatusFilterChipsProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
];

export default function RuleStatusFilterChips({ value, onChange, counts }: RuleStatusFilterChipsProps) {
  return (
    <div className={styles.chips}>
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          className={value === filter.id ? styles.chipActive : styles.chip}
          onClick={() => onChange(filter.id)}
        >
          {filter.label} {counts[filter.id]}
        </button>
      ))}
    </div>
  );
}
