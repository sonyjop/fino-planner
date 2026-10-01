import { describe, expect, it } from 'vitest';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { RuleService, type CreateRuleInput } from './RuleService';
import { TransactionService } from './TransactionService';

setUpTestDatabase();

const rent: CreateRuleInput = {
  name: 'Rent',
  type: 'expense',
  subCategoryId: 'cat-housing',
  amount: 24000,
  repeats: 'monthly',
  dayOfMonth: 5,
  startDate: '2026-09-01',
};

describe('TransactionService', () => {
  it('defaults to planned status on create', async () => {
    const tx = await TransactionService.create({
      title: 'Grocery',
      plannedAmount: 500,
      type: 'expense',
      subCategoryId: 'cat',
    });
    expect(tx.statusKind).toBe('planned');
  });

  it('can be created directly as already-completed (basic-usecases.txt Cashflow #7)', async () => {
    const tx = await TransactionService.create({
      title: 'Grocery',
      plannedAmount: 500,
      type: 'expense',
      subCategoryId: 'cat',
      statusKind: 'actual',
    });
    expect(tx.statusKind).toBe('actual');
  });

  it('status is bidirectional — actual can move back to planned', async () => {
    const created = await TransactionService.create({
      title: 'Grocery',
      plannedAmount: 500,
      type: 'expense',
      subCategoryId: 'cat',
      statusKind: 'actual',
    });
    const undone = await TransactionService.update(created.id, { statusKind: 'planned' });
    expect(undone.statusKind).toBe('planned');
  });

  it('editing the date moves the transaction to a different month bucket', async () => {
    const created = await TransactionService.create({
      title: 'Grocery',
      plannedAmount: 500,
      type: 'expense',
      subCategoryId: 'cat',
      date: '2026-09-15',
    });
    expect(created.monthKey).toBe('2026-09');

    const moved = await TransactionService.update(created.id, { date: '2026-10-01' });
    expect(moved.monthKey).toBe('2026-10');
    expect(moved.year).toBe(2026);
  });

  describe('getForMonth — merging stored transactions with computed virtual planned ones', () => {
    it('includes a virtual planned occurrence for an active rule with nothing stored yet', async () => {
      await RuleService.create(rent);
      const month = await TransactionService.getForMonth(2026, 10);
      expect(month).toHaveLength(1);
      expect(month[0].id).toMatch(/^virtual:/);
      expect(month[0].statusKind).toBe('planned');
    });

    it('shows the real completed transaction instead of a virtual one once completed', async () => {
      const created = await RuleService.create(rent);
      await TransactionService.create({
        title: 'Rent',
        plannedAmount: 24000,
        type: 'expense',
        subCategoryId: 'cat-housing',
        date: '2026-10-05',
        statusKind: 'actual',
        ruleId: created.id,
        ruleGroupId: created.ruleGroupId,
      });

      const month = await TransactionService.getForMonth(2026, 10);
      expect(month).toHaveLength(1); // not two — the virtual one is suppressed
      expect(month[0].statusKind).toBe('actual');
      expect(month[0].id).not.toMatch(/^virtual:/);
    });

    it('an adhoc (non-rule) planned transaction is stored and shown alongside any virtual ones', async () => {
      await RuleService.create(rent);
      await TransactionService.create({
        title: 'One-off gift',
        plannedAmount: 500,
        type: 'expense',
        subCategoryId: 'cat-lifestyle',
        date: '2026-10-12',
      });

      const month = await TransactionService.getForMonth(2026, 10);
      expect(month).toHaveLength(2);
    });

    it('repeated calls never accumulate duplicates, since nothing is written for planned items', async () => {
      await RuleService.create(rent);
      await TransactionService.getForMonth(2026, 10);
      const second = await TransactionService.getForMonth(2026, 10);
      expect(second).toHaveLength(1);
    });
  });

  describe('planned and actual amounts (transactions.feature)', () => {
    const base = { title: 'Grocery', type: 'expense' as const, subCategoryId: 'cat', date: '2026-10-10' };

    it('a planned entry records the entered value as planned, with no actual', async () => {
      const tx = await TransactionService.create({ ...base, plannedAmount: 5000 });
      expect(tx.plannedAmount).toBe(5000);
      expect(tx.actualAmount).toBeUndefined();
    });

    it('created directly as completed records planned = 0 and actual = the entered value', async () => {
      const tx = await TransactionService.create({ ...base, statusKind: 'actual', plannedAmount: 3000, actualAmount: 3000 });
      expect(tx.plannedAmount).toBe(0);
      expect(tx.actualAmount).toBe(3000);
    });

    it('completing a planned entry keeps planned and defaults actual to it', async () => {
      const created = await TransactionService.create({ ...base, plannedAmount: 1000 });
      const completed = await TransactionService.update(created.id, { statusKind: 'actual' });
      expect(completed.plannedAmount).toBe(1000);
      expect(completed.actualAmount).toBe(1000);
    });

    it('completing with a different actual keeps planned untouched', async () => {
      const created = await TransactionService.create({ ...base, plannedAmount: 1000 });
      const completed = await TransactionService.update(created.id, { statusKind: 'actual', actualAmount: 800 });
      expect(completed.plannedAmount).toBe(1000);
      expect(completed.actualAmount).toBe(800);
    });

    it('completing a rule occurrence keeps the rule amount as planned', async () => {
      const rule = await RuleService.create(rent);
      const tx = await TransactionService.create({
        ...base,
        statusKind: 'actual',
        plannedAmount: 24000,
        actualAmount: 25000,
        ruleId: rule.id,
        ruleGroupId: rule.ruleGroupId,
      });
      expect(tx.plannedAmount).toBe(24000);
      expect(tx.actualAmount).toBe(25000);
    });

    it('undo clears actual and leaves planned as it was — 0 for a direct completion', async () => {
      const direct = await TransactionService.create({ ...base, statusKind: 'actual', actualAmount: 2000 });
      const undone = await TransactionService.update(direct.id, { statusKind: 'planned' });
      expect(undone.plannedAmount).toBe(0);
      expect(undone.actualAmount).toBeUndefined();
    });

    it('rule-derived virtual occurrences carry the rule amount as planned', async () => {
      await RuleService.create(rent);
      const [virtual] = await TransactionService.getForMonth(2026, 10);
      expect(virtual.plannedAmount).toBe(24000);
      expect(virtual.actualAmount).toBeUndefined();
    });
  });

  describe('leaf-only master data (master-data.feature)', () => {
    it('stores only the sub-category and instrument ids', async () => {
      const tx = await TransactionService.create({
        title: 'Rent', plannedAmount: 24000, type: 'expense', subCategoryId: 'house-rent', instrumentId: 'regalia',
      });
      const [stored] = await TransactionService.getForMonth(tx.year, Number(tx.monthKey.slice(5)));
      expect(stored.subCategoryId).toBe('house-rent');
      expect(stored.instrumentId).toBe('regalia');
      expect(Object.keys(stored)).not.toContain('categoryId');
      expect(Object.keys(stored)).not.toContain('statusLabelId');
    });

    it("a rule's instrument is pre-filled on its occurrence, and changing it on completion leaves the rule alone", async () => {
      const rule = await RuleService.create({ ...rent, instrumentId: 'regalia' });
      const [virtual] = await TransactionService.getForMonth(2026, 10);
      expect(virtual.instrumentId).toBe('regalia');

      await TransactionService.create({
        title: virtual.title, type: virtual.type, subCategoryId: virtual.subCategoryId, date: virtual.date,
        plannedAmount: virtual.plannedAmount, statusKind: 'actual', instrumentId: 'amex',
        ruleId: virtual.ruleId, ruleGroupId: virtual.ruleGroupId,
      });
      const [completed] = await TransactionService.getForMonth(2026, 10);
      expect(completed.instrumentId).toBe('amex');
      expect((await RuleService.getVersion(rule.id))?.instrumentId).toBe('regalia');
    });

    it('a rule whose sub-category is archived keeps planning occurrences', async () => {
      const { MetadataService } = await import('./MetadataService');
      await MetadataService.ensureSeeded();
      const housing = (await MetadataService.list()).find((g) => g.name === 'Housing')!;
      const rentId = housing.items[0].id;
      await RuleService.create({ ...rent, subCategoryId: rentId });
      await MetadataService.removeItem(rentId); // used by the rule -> archived
      const month = await TransactionService.getForMonth(2026, 11);
      expect(month).toHaveLength(1);
      expect(month[0].subCategoryId).toBe(rentId);
    });
  });
});
