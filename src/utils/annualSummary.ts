import type { TransactionType } from '../models/common';
import type { FiscalYearSummary, PlannedCommitted } from '../models/FiscalYearSummary';
import type { MetadataGroup } from '../models/MetadataGroup';
import { resolveLeaf } from './metadata';

export const UNCATEGORISED_ID = 'uncategorised';

export interface CategoryRow extends PlannedCommitted {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Planned as a % of the section's planned total (0 when the section plans nothing). */
  share: number;
}

export interface CategorySection {
  type: TransactionType;
  rows: CategoryRow[];
  total: PlannedCommitted;
}

/**
 * Pure — rolls the stored per-sub-category figures up to their category using current Master
 * Data at render time (archived categories included — history keeps its names). Ids that
 * resolve to nothing roll into one "Uncategorised" row, all-zero rows are dropped, and rows are
 * ordered by planned amount, largest first.
 */
export function buildCategorySection(
  summary: FiscalYearSummary,
  groups: MetadataGroup[],
  type: TransactionType,
): CategorySection {
  const byRow = new Map<string, CategoryRow>();

  for (const [subCategoryId, figures] of Object.entries(summary.categories[type])) {
    const leaf = resolveLeaf(groups, subCategoryId);
    const group = leaf?.group.key === 'category' ? leaf.group : undefined;
    const id = group ? group.id : UNCATEGORISED_ID;
    const row = byRow.get(id) ?? {
      id,
      name: group?.name ?? 'Uncategorised',
      icon: group?.icon ?? 'tag',
      color: group?.color ?? '#6b7280',
      planned: 0,
      committed: 0,
      share: 0,
    };
    row.planned += figures.planned;
    row.committed += figures.committed;
    byRow.set(id, row);
  }

  const all = [...byRow.values()];
  const total = all.reduce(
    (acc, row) => ({ planned: acc.planned + row.planned, committed: acc.committed + row.committed }),
    { planned: 0, committed: 0 },
  );
  const rows = all
    .filter((row) => row.planned !== 0 || row.committed !== 0)
    .map((row) => ({ ...row, share: total.planned ? (row.planned / total.planned) * 100 : 0 }))
    .sort((a, b) => b.planned - a.planned);

  return { type, rows, total };
}

/** Whole-FY totals — by construction the sum of the 12 month rows. */
export function yearTotals(summary: FiscalYearSummary): Record<TransactionType, PlannedCommitted> {
  const totals = { income: { planned: 0, committed: 0 }, expense: { planned: 0, committed: 0 } };
  for (const month of summary.months) {
    for (const type of ['income', 'expense'] as const) {
      totals[type].planned += month[type].planned;
      totals[type].committed += month[type].committed;
    }
  }
  return totals;
}
