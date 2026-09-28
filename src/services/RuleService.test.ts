import { afterEach, describe, expect, it, vi } from 'vitest';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { RuleService, type CreateRuleInput } from './RuleService';

setUpTestDatabase();

const baseRule: CreateRuleInput = {
  name: 'Netflix',
  type: 'expense',
  categoryId: 'cat-lifestyle',
  amount: 649,
  repeats: 'monthly',
  dayOfMonth: 5,
  startDate: '2026-09-01',
};

describe('RuleService', () => {
  it('creates a rule as version 1, active', async () => {
    const rule = await RuleService.create(baseRule);
    expect(rule.version).toBe(1);
    expect(rule.status).toBe('active');
  });

  it('revising content creates a new version and deprecates the old row', async () => {
    const v1 = await RuleService.create(baseRule);
    const v2 = await RuleService.revise(v1.ruleGroupId, { amount: 699, effectiveFrom: '2026-10-01' });

    expect(v2.version).toBe(2);
    expect(v2.ruleGroupId).toBe(v1.ruleGroupId);
    expect(v2.status).toBe('active'); // inherited from v1's pre-supersede status

    const history = await RuleService.getHistory(v1.ruleGroupId);
    expect(history).toHaveLength(2);
    const oldVersion = history.find((r) => r.id === v1.id)!;
    expect(oldVersion.status).toBe('deprecated');
    expect(oldVersion.effectiveTo).toBe('2026-10-01');
  });

  it('pausing a rule mutates status in place — no new version created', async () => {
    const v1 = await RuleService.create(baseRule);
    await RuleService.setStatus(v1.ruleGroupId, 'paused');

    const history = await RuleService.getHistory(v1.ruleGroupId);
    expect(history).toHaveLength(1); // still one row
    expect(history[0].id).toBe(v1.id); // same row
    expect(history[0].version).toBe(1); // version unchanged
    expect(history[0].status).toBe('paused');
  });

  it('a content edit after pausing carries the paused status forward, and deprecates the old row anyway', async () => {
    const v1 = await RuleService.create(baseRule);
    await RuleService.setStatus(v1.ruleGroupId, 'paused');
    const v2 = await RuleService.revise(v1.ruleGroupId, { amount: 699 });

    expect(v2.status).toBe('paused'); // inherited, not reset to active

    const history = await RuleService.getHistory(v1.ruleGroupId);
    const oldRow = history.find((r) => r.version === 1)!;
    expect(oldRow.status).toBe('deprecated'); // force-deprecated regardless of its 'paused' status
  });

  it('changing the name spins off a new lineage, inherits status, and cancels the old lineage', async () => {
    const v1 = await RuleService.create(baseRule);
    await RuleService.setStatus(v1.ruleGroupId, 'paused');

    const newLineage = await RuleService.revise(v1.ruleGroupId, { name: 'Netflix Premium' });

    expect(newLineage.ruleGroupId).not.toBe(v1.ruleGroupId);
    expect(newLineage.version).toBe(1);
    expect(newLineage.status).toBe('paused'); // inherited pre-supersede status

    const oldLineageHistory = await RuleService.getHistory(v1.ruleGroupId);
    expect(oldLineageHistory).toHaveLength(1); // content untouched, just status flipped
    expect(oldLineageHistory[0].status).toBe('cancelled');
  });

  it('list() surfaces only the latest version per lineage', async () => {
    const v1 = await RuleService.create(baseRule);
    await RuleService.revise(v1.ruleGroupId, { amount: 699 });

    const list = await RuleService.list();
    const forThisGroup = list.filter((r) => r.ruleGroupId === v1.ruleGroupId);
    expect(forThisGroup).toHaveLength(1);
    expect(forThisGroup[0].version).toBe(2);
  });

  it('creates a quarterly rule with a start month', async () => {
    const rule = await RuleService.create({
      ...baseRule,
      repeats: 'quarterly',
      monthOfYear: 1, // Jan start -> Jan/Apr/Jul/Oct
      dayOfMonth: 10,
    });
    expect(rule.repeats).toBe('quarterly');
    expect(rule.monthOfYear).toBe(1);
  });

  describe('expiry (rule-usecase.xt A/B)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('list() stamps a rule as expired once today passes its endDate', async () => {
      const rule = await RuleService.create({ ...baseRule, endDate: '2026-09-30' });

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 15)); // 15 Oct 2026 — past the end date

      const list = await RuleService.list();
      const found = list.find((r) => r.ruleGroupId === rule.ruleGroupId)!;
      expect(found.status).toBe('expired');

      // Stamped for real, not just returned in-memory — a fresh read confirms it stuck.
      vi.useRealTimers();
      const history = await RuleService.getHistory(rule.ruleGroupId);
      expect(history[0].status).toBe('expired');
    });

    it('does not touch a rule whose endDate has not passed yet', async () => {
      const rule = await RuleService.create({ ...baseRule, endDate: '2026-12-31' });

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 15));

      const list = await RuleService.list();
      const found = list.find((r) => r.ruleGroupId === rule.ruleGroupId)!;
      expect(found.status).toBe('active');
    });

    it('never-ending rules (no endDate) never expire', async () => {
      const rule = await RuleService.create(baseRule); // no endDate

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2030, 0, 1));

      const list = await RuleService.list();
      const found = list.find((r) => r.ruleGroupId === rule.ruleGroupId)!;
      expect(found.status).toBe('active');
    });
  });
});
