import { describe, expect, it } from 'vitest';
import type { FiscalYearSummary } from '../models/FiscalYearSummary';
import { fiscalYearSummaryRepository } from '../repositories';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { fiscalYearStart } from '../utils/date';
import { FiscalYearSummaryService } from './FiscalYearSummaryService';
import { RuleService, type CreateRuleInput } from './RuleService';
import { TransactionService } from './TransactionService';

setUpTestDatabase();

// FY 2030–31 keeps these tests independent of the real "today".
const FY = 2030;

const monthly: CreateRuleInput = {
  name: 'Rent',
  type: 'expense',
  subCategoryId: 'housing',
  amount: 1000,
  repeats: 'monthly',
  dayOfMonth: 5,
  startDate: '2029-01-01',
};

function month(summary: FiscalYearSummary, monthKey: string) {
  const found = summary.months.find((m) => m.monthKey === monthKey);
  if (!found) throw new Error(`no ${monthKey}`);
  return found;
}

function yearExpense(summary: FiscalYearSummary) {
  return summary.months.reduce(
    (acc, m) => ({ planned: acc.planned + m.expense.planned, committed: acc.committed + m.expense.committed }),
    { planned: 0, committed: 0 },
  );
}

const adhoc = { title: 'x', type: 'expense' as const, subCategoryId: 'misc' };

describe('FiscalYearSummaryService', () => {
  it('builds and saves a document the first time an FY is read', async () => {
    expect(await fiscalYearSummaryRepository.get(FY)).toBeUndefined();
    const summary = await FiscalYearSummaryService.get(FY);
    expect(summary.months).toHaveLength(12);
    expect(await fiscalYearSummaryRepository.get(FY)).toEqual(summary);
  });

  it('a never-completed monthly rule counts 12 × amount as planned and nothing committed', async () => {
    await RuleService.create(monthly);
    expect(yearExpense(await FiscalYearSummaryService.get(FY))).toEqual({ planned: 12000, committed: 0 });
  });

  it('a rule occurrence completed at a different amount counts once: planned rule amount, committed actual', async () => {
    const rule = await RuleService.create(monthly);
    await TransactionService.create({
      ...adhoc,
      subCategoryId: 'housing',
      date: '2030-08-05',
      statusKind: 'actual',
      plannedAmount: 1000,
      actualAmount: 1200,
      ruleId: rule.id,
      ruleGroupId: rule.ruleGroupId,
    });
    const summary = await FiscalYearSummaryService.get(FY);
    expect(month(summary, '2030-08').expense).toEqual({ planned: 1000, committed: 1200 });
    expect(yearExpense(summary)).toEqual({ planned: 12000, committed: 1200 });
  });

  it('a direct completion adds only to committed; an adhoc planned entry only to planned', async () => {
    await TransactionService.create({ ...adhoc, date: '2030-10-10', statusKind: 'actual', actualAmount: 3000 });
    await TransactionService.create({ ...adhoc, date: '2030-06-10', plannedAmount: 5000 });
    const summary = await FiscalYearSummaryService.get(FY);
    expect(month(summary, '2030-10').expense).toEqual({ planned: 0, committed: 3000 });
    expect(month(summary, '2030-06').expense).toEqual({ planned: 5000, committed: 0 });
  });

  it('undo drops committed and leaves planned unchanged, updated as part of the save', async () => {
    const planned = await TransactionService.create({ ...adhoc, date: '2030-11-10', plannedAmount: 2000 });
    await TransactionService.update(planned.id, { statusKind: 'actual' });
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2030-11').expense).toEqual({ planned: 2000, committed: 2000 });

    await TransactionService.update(planned.id, { statusKind: 'planned' });
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2030-11').expense).toEqual({ planned: 2000, committed: 0 });

    const direct = await TransactionService.create({ ...adhoc, date: '2030-11-20', statusKind: 'actual', actualAmount: 700 });
    await TransactionService.update(direct.id, { statusKind: 'planned' });
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2030-11').expense).toEqual({ planned: 2000, committed: 0 });
  });

  it('moving a date across the FY boundary updates both FY documents before the save resolves', async () => {
    const tx = await TransactionService.create({ ...adhoc, date: '2031-03-31', plannedAmount: 400 });
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2031-03').expense.planned).toBe(400);

    await TransactionService.update(tx.id, { date: '2031-04-01' });
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2031-03').expense.planned).toBe(0);
    expect(month((await fiscalYearSummaryRepository.get(FY + 1))!, '2031-04').expense.planned).toBe(400);
  });

  it('deleting a transaction updates its FY document', async () => {
    const tx = await TransactionService.create({ ...adhoc, date: '2030-07-01', plannedAmount: 900 });
    await TransactionService.delete(tx.id);
    expect(month((await fiscalYearSummaryRepository.get(FY))!, '2030-07').expense.planned).toBe(0);
  });

  it('a rule change recomputes every stored FY document and the current FY', async () => {
    await FiscalYearSummaryService.get(FY); // stored, empty
    await RuleService.create(monthly);
    expect(yearExpense((await fiscalYearSummaryRepository.get(FY))!).planned).toBe(12000);
    expect(await fiscalYearSummaryRepository.get(fiscalYearStart(new Date()))).toBeDefined();
  });

  it('paused and cancelled rules contribute nothing', async () => {
    await FiscalYearSummaryService.get(FY); // stored first, so the rule events must keep it current
    const paused = await RuleService.create(monthly);
    const cancelled = await RuleService.create({ ...monthly, name: 'Gym' });
    await RuleService.setStatus(paused.ruleGroupId, 'paused');
    await RuleService.setStatus(cancelled.ruleGroupId, 'cancelled');
    expect(yearExpense((await fiscalYearSummaryRepository.get(FY))!).planned).toBe(0);
  });

  it('a mid-year revision counts the old amount before and the new amount after, never both', async () => {
    await FiscalYearSummaryService.get(FY); // stored first, so the rule events must keep it current
    const rule = await RuleService.create(monthly);
    await RuleService.revise(rule.ruleGroupId, { amount: 1100, effectiveFrom: '2030-10-01' });
    const summary = (await fiscalYearSummaryRepository.get(FY))!;
    expect(month(summary, '2030-09').expense.planned).toBe(1000);
    expect(month(summary, '2030-10').expense.planned).toBe(1100);
    expect(yearExpense(summary).planned).toBe(6 * 1000 + 6 * 1100);
  });

  it('a rule that starts and ends mid-year only counts its own months', async () => {
    await FiscalYearSummaryService.get(FY); // stored first, so the rule events must keep it current
    await RuleService.create({ ...monthly, startDate: '2030-09-01', endDate: '2030-12-31' });
    const summary = (await fiscalYearSummaryRepository.get(FY))!;
    expect(summary.months.filter((m) => m.expense.planned > 0).map((m) => m.monthKey)).toEqual([
      '2030-09', '2030-10', '2030-11', '2030-12',
    ]);
  });

  it('quarterly and yearly rules fall only in the months they fire', async () => {
    await FiscalYearSummaryService.get(FY); // stored first, so the rule events must keep it current
    await RuleService.create({ ...monthly, name: 'Q', amount: 3000, repeats: 'quarterly', monthOfYear: 4 });
    await RuleService.create({ ...monthly, name: 'Y', amount: 12000, repeats: 'yearly', monthOfYear: 1 });
    const summary = (await fiscalYearSummaryRepository.get(FY))!;
    const nonZero = Object.fromEntries(
      summary.months.filter((m) => m.expense.planned > 0).map((m) => [m.monthKey, m.expense.planned]),
    );
    expect(nonZero).toEqual({ '2030-04': 3000, '2030-07': 3000, '2030-10': 3000, '2031-01': 15000 });
  });
});
