import { describe, expect, it } from 'vitest';
import type { FiscalYearSummary } from '../models/FiscalYearSummary';
import type { MetadataGroup, MetadataGroupKey } from '../models/MetadataGroup';
import { buildCategorySection, UNCATEGORISED_ID, yearTotals } from './annualSummary';

function group(
  id: string,
  name: string,
  items: { id: string; label: string; archived?: boolean }[],
  extra: { key?: MetadataGroupKey; archived?: boolean } = {},
): MetadataGroup {
  return {
    id,
    key: extra.key ?? 'category',
    name,
    icon: 'tag',
    color: '#123456',
    isSystem: false,
    archived: extra.archived ?? false,
    items: items.map((item, order) => ({ ...item, order, archived: item.archived ?? false })),
    order: 0,
    createdAt: '',
    updatedAt: '',
  };
}

const groups = [
  group('housing', 'Housing', [
    { id: 'rent', label: 'House Rent' },
    { id: 'tax', label: 'Property Tax', archived: true },
  ]),
  group('essentials', 'Essentials', [{ id: 'grocery', label: 'Grocery' }]),
  group('lifestyle', 'Lifestyle', [{ id: 'dining', label: 'Dining Out' }]),
  group('transport', 'Transport', [{ id: 'fuel', label: 'Fuel', archived: true }], { archived: true }),
  group('credit', 'Credit Card', [{ id: 'regalia', label: 'Regalia' }], { key: 'paymentMode' }),
];

function summary(categories: FiscalYearSummary['categories'], expensePerMonth = 0): FiscalYearSummary {
  return {
    fyStartYear: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      monthKey: `m${i}`,
      income: { planned: 0, committed: 0 },
      expense: { planned: expensePerMonth, committed: 0 },
    })),
    categories,
    updatedAt: '',
  };
}

describe('buildCategorySection', () => {
  it('rolls sub-categories up to their category — archived sub-categories included', () => {
    const section = buildCategorySection(
      summary({ income: {}, expense: { rent: { planned: 6000, committed: 6000 }, tax: { planned: 1500, committed: 0 } } }),
      groups,
      'expense',
    );
    expect(section.rows).toHaveLength(1);
    expect(section.rows[0]).toMatchObject({ id: 'housing', name: 'Housing', planned: 7500, committed: 6000 });
  });

  it('still shows an archived category for a year it was used in', () => {
    const section = buildCategorySection(summary({ income: {}, expense: { fuel: { planned: 900, committed: 900 } } }), groups, 'expense');
    expect(section.rows[0]).toMatchObject({ id: 'transport', name: 'Transport', planned: 900 });
  });

  it('orders by planned desc, hides all-zero rows and shows share of the section planned total', () => {
    const section = buildCategorySection(
      summary({
        income: {},
        expense: {
          grocery: { planned: 2500, committed: 1000 },
          rent: { planned: 7500, committed: 7500 },
          dining: { planned: 0, committed: 0 },
        },
      }),
      groups,
      'expense',
    );
    expect(section.rows.map((r) => r.name)).toEqual(['Housing', 'Essentials']);
    expect(section.rows.map((r) => r.share)).toEqual([75, 25]);
    expect(section.total).toEqual({ planned: 10000, committed: 8500 });
  });

  it('rolls ids that resolve to nothing (or to a non-category leaf) into one "Uncategorised" row', () => {
    const section = buildCategorySection(
      summary({
        income: {},
        expense: {
          rent: { planned: 100, committed: 0 },
          missing: { planned: 50, committed: 10 },
          regalia: { planned: 25, committed: 5 },
        },
      }),
      groups,
      'expense',
    );
    const uncategorised = section.rows.find((r) => r.id === UNCATEGORISED_ID);
    expect(uncategorised).toMatchObject({ name: 'Uncategorised', planned: 75, committed: 15 });
    expect(section.total).toEqual({ planned: 175, committed: 15 });
  });

  it('uses the current Master Data name, so a rename shows without recomputing', () => {
    const renamed = [group('housing', 'Home', [{ id: 'rent', label: 'Rent' }])];
    const section = buildCategorySection(summary({ income: {}, expense: { rent: { planned: 1, committed: 0 } } }), renamed, 'expense');
    expect(section.rows[0].name).toBe('Home');
  });

  it('keeps a category used for both types in separate sections', () => {
    const s = summary({ income: { grocery: { planned: 300, committed: 0 } }, expense: { grocery: { planned: 900, committed: 0 } } });
    expect(buildCategorySection(s, groups, 'income').total.planned).toBe(300);
    expect(buildCategorySection(s, groups, 'expense').total.planned).toBe(900);
  });
});

describe('yearTotals', () => {
  it('is the sum of the 12 month rows', () => {
    expect(yearTotals(summary({ income: {}, expense: {} }, 250)).expense).toEqual({ planned: 3000, committed: 0 });
  });
});
