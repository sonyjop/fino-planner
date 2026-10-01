import IconBadge from '../../components/IconBadge';
import type { CategorySection } from '../../utils/annualSummary';
import Amount from './Amount';
import styles from './CategoryBreakdownTable.module.css';

interface CategoryBreakdownTableProps {
  sections: CategorySection[];
}

const SECTION_TITLES = { income: 'Income', expense: 'Expense' } as const;

export default function CategoryBreakdownTable({ sections }: CategoryBreakdownTableProps) {
  const visible = sections.filter((section) => section.rows.length > 0);
  if (visible.length === 0) {
    return <p className={styles.empty}>Nothing planned for this year yet</p>;
  }

  return (
    <div className={styles.wrapper}>
      {visible.map((section) => (
        <table key={section.type} className={styles.table} aria-label={`${SECTION_TITLES[section.type]} by category`}>
          <thead>
            <tr>
              <th className={styles[section.type]}>{SECTION_TITLES[section.type]}</th>
              <th>Planned</th>
              <th>Committed</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span className={styles.category}>
                    <IconBadge icon={row.icon} color={row.color} />
                    <span>{row.name}</span>
                  </span>
                </th>
                <td><Amount value={row.planned} compact /></td>
                <td><Amount value={row.committed} compact /></td>
                <td>{Math.round(row.share)}%</td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <th scope="row">Total</th>
              <td><Amount value={section.total.planned} compact /></td>
              <td><Amount value={section.total.committed} compact /></td>
              <td />
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}
