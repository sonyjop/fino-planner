import { describe, expect, it } from 'vitest';
import type { RecurringRule } from '../models/RecurringRule';
import { transactionRepository } from '../repositories';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { computeVirtualPlannedTransactions, RuleEngineService } from './RuleEngineService';
import { RuleService, type CreateRuleInput } from './RuleService';

setUpTestDatabase();

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  const now = new Date().toISOString();
  return {
    id: 'r1',
    ruleGroupId: 'g1',
    version: 1,
    effectiveFrom: '2026-01-01',
    name: 'Rent',
    type: 'expense',
    subCategoryId: 'cat-housing',
    amount: 24000,
    repeats: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-01',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('computeVirtualPlannedTransactions (pure — no persistence at all)', () => {
  it('produces one planned occurrence for an active monthly rule', () => {
    const result = computeVirtualPlannedTransactions([rule()], 2026, 10);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-10-05');
    expect(result[0].statusKind).toBe('planned');
    expect(result[0].id).toMatch(/^virtual:/);
  });

  it('produces nothing for a paused rule', () => {
    expect(computeVirtualPlannedTransactions([rule({ status: 'paused' })], 2026, 10)).toHaveLength(0);
  });

  it('produces nothing for a cancelled rule', () => {
    expect(computeVirtualPlannedTransactions([rule({ status: 'cancelled' })], 2026, 10)).toHaveLength(0);
  });

  it('is idempotent — calling it twice for the same month produces the same single result, no accumulation possible', () => {
    const rules = [rule()];
    const first = computeVirtualPlannedTransactions(rules, 2026, 10);
    const second = computeVirtualPlannedTransactions(rules, 2026, 10);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).toEqual(second[0]);
  });

  it("a deprecated version still covers a gap month before the newer version's effectiveFrom takes over", () => {
    const oldVersion = rule({
      id: 'r1',
      version: 1,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-05-01',
      status: 'deprecated',
      amount: 1000,
    });
    const newVersion = rule({
      id: 'r2',
      version: 2,
      effectiveFrom: '2026-05-01',
      status: 'active',
      amount: 1200,
    });

    const feb = computeVirtualPlannedTransactions([oldVersion, newVersion], 2026, 2);
    expect(feb).toHaveLength(1);
    expect(feb[0].plannedAmount).toBe(1000);
    expect(feb[0].ruleId).toBe('r1');

    const may = computeVirtualPlannedTransactions([oldVersion, newVersion], 2026, 5);
    expect(may).toHaveLength(1);
    expect(may[0].plannedAmount).toBe(1200);
    expect(may[0].ruleId).toBe('r2');
  });

  it('an expired rule still produces occurrences within its endDate, but not beyond it', () => {
    const expiredRule = rule({ status: 'expired', endDate: '2026-06-30' });
    expect(computeVirtualPlannedTransactions([expiredRule], 2026, 6)).toHaveLength(1);
    expect(computeVirtualPlannedTransactions([expiredRule], 2026, 7)).toHaveLength(0);
  });

  it('quarterly fires every 3rd month from the configured start month', () => {
    const q = rule({ repeats: 'quarterly', monthOfYear: 1, dayOfMonth: 10 }); // Jan start
    expect(computeVirtualPlannedTransactions([q], 2026, 1)).toHaveLength(1); // Jan
    expect(computeVirtualPlannedTransactions([q], 2026, 2)).toHaveLength(0); // Feb
    expect(computeVirtualPlannedTransactions([q], 2026, 4)).toHaveLength(1); // Apr
    expect(computeVirtualPlannedTransactions([q], 2026, 7)).toHaveLength(1); // Jul
    expect(computeVirtualPlannedTransactions([q], 2026, 10)).toHaveLength(1); // Oct
  });

  it('REGRESSION: a rename (old lineage cancelled, new lineage active) never double-plans the same month', () => {
    const oldRule = rule({ id: 'old1', ruleGroupId: 'gOld', status: 'cancelled', effectiveFrom: '2026-01-01' });
    const newRule = rule({
      id: 'new1',
      ruleGroupId: 'gNew',
      status: 'active',
      effectiveFrom: '2026-09-26',
      name: 'Rent (renamed)',
    });
    const result = computeVirtualPlannedTransactions([oldRule, newRule], 2026, 10);
    expect(result).toHaveLength(1);
    expect(result[0].ruleGroupId).toBe('gNew');
  });

  it('a month before effectiveFrom, or after effectiveTo, produces nothing', () => {
    const v = rule({ effectiveFrom: '2026-09-01', effectiveTo: '2026-11-01' });
    expect(computeVirtualPlannedTransactions([v], 2026, 8)).toHaveLength(0); // before
    expect(computeVirtualPlannedTransactions([v], 2026, 11)).toHaveLength(0); // at/after effectiveTo
    expect(computeVirtualPlannedTransactions([v], 2026, 10)).toHaveLength(1); // inside the window
  });
});

const rent: CreateRuleInput = {
  name: 'Rent',
  type: 'expense',
  subCategoryId: 'cat-housing',
  amount: 24000,
  repeats: 'monthly',
  dayOfMonth: 5,
  startDate: '2026-09-01',
};

describe('RuleEngineService.getExecutionInfo', () => {
  it('lastExecutedDate is undefined until a completed transaction is actually stored', async () => {
    const created = await RuleService.create(rent);
    expect((await RuleEngineService.getExecutionInfo(created)).lastExecutedDate).toBeUndefined();
  });

  it('lastExecutedDate reflects the newest stored completed transaction for the lineage', async () => {
    const created = await RuleService.create(rent);
    await transactionRepository.save({
      id: 'tx1',
      title: 'Rent',
      plannedAmount: 24000,
      actualAmount: 24000,
      type: 'expense',
      subCategoryId: 'cat-housing',
      date: '2026-10-05',
      statusKind: 'actual',
      ruleId: created.id,
      ruleGroupId: created.ruleGroupId,
      monthKey: '2026-10',
      year: 2026,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const info = await RuleEngineService.getExecutionInfo(created);
    expect(info.lastExecutedDate).toBe('2026-10-05');
  });

  it('nextDueDate is undefined for a non-active rule', async () => {
    const created = await RuleService.create(rent);
    await RuleService.setStatus(created.ruleGroupId, 'paused');
    const paused = await RuleService.setStatus(created.ruleGroupId, 'paused');
    expect((await RuleEngineService.getExecutionInfo(paused)).nextDueDate).toBeUndefined();
  });
});
