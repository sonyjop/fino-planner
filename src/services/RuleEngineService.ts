import type { RecurringRule } from '../models/RecurringRule';
import type { Transaction } from '../models/Transaction';
import { ruleRepository, transactionRepository } from '../repositories';
import { daysInMonth, pad2, todayDateString } from '../utils/date';

/** Returns the ISO date this rule version fires on in the given month, or null if it doesn't. */
function occurrenceDate(rule: RecurringRule, year: number, month: number): string | null {
  if (rule.repeats === 'monthly' && rule.dayOfMonth) {
    const day = Math.min(rule.dayOfMonth, daysInMonth(year, month));
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (rule.repeats === 'quarterly' && rule.monthOfYear && rule.dayOfMonth) {
    const offsetFromStart = (((month - rule.monthOfYear) % 3) + 3) % 3;
    if (offsetFromStart !== 0) return null;
    const day = Math.min(rule.dayOfMonth, daysInMonth(year, month));
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (rule.repeats === 'yearly' && rule.monthOfYear === month && rule.dayOfMonth) {
    const day = Math.min(rule.dayOfMonth, daysInMonth(year, month));
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  return null;
}

/** Walks forward from `fromDate` to find this rule's next occurrence, or undefined if it won't fire again. */
function computeNextDueDate(rule: RecurringRule, fromDate: string): string | undefined {
  if (rule.status !== 'active') return undefined;
  const startFrom = fromDate > rule.effectiveFrom ? fromDate : rule.effectiveFrom;
  const [fy, fm] = startFrom.split('-').map(Number);

  for (let offset = 0; offset < 24; offset++) {
    const d = new Date(fy, fm - 1 + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const candidate = occurrenceDate(rule, year, month);
    if (!candidate || candidate < startFrom) continue;
    if (rule.endDate && candidate > rule.endDate) return undefined; // dates only increase from here
    return candidate;
  }
  return undefined;
}

/** Does this version's own window — including its natural end date, if any — cover this month? */
function versionCoversMonth(version: RecurringRule, monthStart: string): boolean {
  if (version.effectiveFrom > monthStart) return false;
  if (version.effectiveTo && version.effectiveTo <= monthStart) return false;
  if (version.endDate && version.endDate < monthStart) return false;
  return true;
}

/**
 * Pure — no persistence at all. Rule-derived planned occurrences are never stored
 * (rule-usecase.xt: "planned items never stored to DB"); every month is recomputed fresh
 * from whatever the rules currently say, so there's nothing to keep in sync, migrate, or
 * dedupe. A rule's own history (effectiveFrom/effectiveTo/endDate/status) already fully
 * determines what a given month produces:
 *
 * - 'active' or 'deprecated' versions produce an occurrence if their window covers the month
 *   ('deprecated' still covers any "gap" months before a newer version's effectiveFrom takes
 *   over — rule-usecase.xt A's bracketed note).
 * - 'expired' also produces one if the window covers the month — expiry only means *today* is
 *   past the endDate, not that every month ever was; the endDate itself already excludes any
 *   month beyond it, via versionCoversMonth.
 * - 'paused' and 'cancelled' produce nothing, regardless of what their window would otherwise say.
 *
 * The synthetic id (`virtual:<ruleId>:<monthKey>`) lets the UI recognize a not-yet-real item —
 * only completing one (via TransactionService) ever creates an actual stored row.
 */
export function computeVirtualPlannedTransactions(
  allRuleVersions: RecurringRule[],
  year: number,
  month: number,
): Transaction[] {
  const monthKey = `${year}-${pad2(month)}`;
  const monthStart = `${monthKey}-01`;

  const byGroup = new Map<string, RecurringRule[]>();
  for (const rule of allRuleVersions) {
    const list = byGroup.get(rule.ruleGroupId);
    if (list) list.push(rule);
    else byGroup.set(rule.ruleGroupId, [rule]);
  }

  const now = new Date().toISOString();
  const results: Transaction[] = [];

  for (const versions of byGroup.values()) {
    const version = versions.find((v) => versionCoversMonth(v, monthStart));
    if (!version || version.status === 'paused' || version.status === 'cancelled') continue;

    const occursOn = occurrenceDate(version, year, month);
    if (!occursOn) continue;

    results.push({
      id: `virtual:${version.id}:${monthKey}`,
      title: version.name,
      plannedAmount: version.amount,
      type: version.type,
      subCategoryId: version.subCategoryId,
      instrumentId: version.instrumentId,
      date: occursOn,
      statusKind: 'planned',
      ruleId: version.id,
      ruleGroupId: version.ruleGroupId,
      monthKey,
      year,
      createdAt: now,
      updatedAt: now,
    });
  }

  return results;
}

/**
 * Pure — merges what's genuinely stored for a month (adhoc planned entries, and anything
 * completed) with that month's computed virtual occurrences, dropping a virtual one wherever
 * a real row already exists for its rule lineage (i.e. it's already been completed). Shared
 * by the Cashflow month view and the FY summary so a completed occurrence counts exactly once.
 */
export function mergeStoredWithVirtual(stored: Transaction[], virtual: Transaction[]): Transaction[] {
  const storedRuleGroupIds = new Set(stored.filter((tx) => tx.ruleGroupId).map((tx) => tx.ruleGroupId));
  const unclaimed = virtual.filter((tx) => !storedRuleGroupIds.has(tx.ruleGroupId));
  return [...stored, ...unclaimed];
}

export const RuleEngineService = {
  /** Convenience wrapper — fetches every rule version, then delegates to the pure function above. */
  async getPlannedForMonth(year: number, month: number): Promise<Transaction[]> {
    const all = await ruleRepository.getAll();
    return computeVirtualPlannedTransactions(all, year, month);
  },

  /**
   * `lastExecutedDate` is the newest transaction date ever actually completed under this
   * lineage (rule-derived planned items are never stored, so this only ever finds real,
   * completed ones). `nextDueDate` projects forward from today using the version currently
   * active. Neither is persisted, so they can never go stale.
   */
  async getExecutionInfo(rule: RecurringRule): Promise<{ lastExecutedDate?: string; nextDueDate?: string }> {
    const transactions = await transactionRepository.getByRuleGroupId(rule.ruleGroupId);
    const lastExecutedDate = transactions.length
      ? transactions.reduce((latest, tx) => (tx.date > latest ? tx.date : latest), transactions[0].date)
      : undefined;

    return { lastExecutedDate, nextDueDate: computeNextDueDate(rule, todayDateString()) };
  },
};
