import { describe, expect, it } from 'vitest';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { RuleService, type CreateRuleInput } from './RuleService';
import { TransactionService } from './TransactionService';

setUpTestDatabase();

const rent: CreateRuleInput = {
  name: 'Rent',
  type: 'expense',
  categoryId: 'cat-housing',
  amount: 24000,
  repeats: 'monthly',
  dayOfMonth: 5,
  startDate: '2026-09-01',
};

describe('TransactionService', () => {
  it('defaults to planned status on create', async () => {
    const tx = await TransactionService.create({
      title: 'Grocery',
      amount: 500,
      type: 'expense',
      categoryId: 'cat',
    });
    expect(tx.statusKind).toBe('planned');
  });

  it('can be created directly as already-completed (basic-usecases.txt Cashflow #7)', async () => {
    const tx = await TransactionService.create({
      title: 'Grocery',
      amount: 500,
      type: 'expense',
      categoryId: 'cat',
      statusKind: 'actual',
    });
    expect(tx.statusKind).toBe('actual');
  });

  it('status is bidirectional — actual can move back to planned', async () => {
    const created = await TransactionService.create({
      title: 'Grocery',
      amount: 500,
      type: 'expense',
      categoryId: 'cat',
      statusKind: 'actual',
    });
    const undone = await TransactionService.update(created.id, { statusKind: 'planned' });
    expect(undone.statusKind).toBe('planned');
  });

  it('editing the date moves the transaction to a different month bucket', async () => {
    const created = await TransactionService.create({
      title: 'Grocery',
      amount: 500,
      type: 'expense',
      categoryId: 'cat',
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
        amount: 24000,
        type: 'expense',
        categoryId: 'cat-housing',
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
        amount: 500,
        type: 'expense',
        categoryId: 'cat-lifestyle',
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
});
