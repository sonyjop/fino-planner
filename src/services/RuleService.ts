import type { TransactionType } from '../models/common';
import type { RecurringRule, RuleCadence, RuleStatus } from '../models/RecurringRule';
import { ruleRepository } from '../repositories';
import { createId } from '../utils/id';
import { todayDateString } from '../utils/date';

export interface CreateRuleInput {
  name: string;
  description?: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  repeats: RuleCadence;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate: string;
  /** Undefined = never-ending (rule-usecase.xt B). */
  endDate?: string;
}

/**
 * Content only — status is never part of a revision (rule-usecase.xt #2 lists only amount/
 * date/frequency as version-triggering). Use RuleService.setStatus for status.
 */
export interface ReviseRuleInput {
  name?: string;
  description?: string;
  type?: TransactionType;
  categoryId?: string;
  amount?: number;
  repeats?: RuleCadence;
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: string;
  /** Defaults to today — when the revised version starts applying. */
  effectiveFrom?: string;
}

/** architecture.md §2.4 — changing any of these starts a new lineage instead of a new version. */
const CHAIN_BREAKING_FIELDS = ['name', 'categoryId', 'type'] as const;

/** Only these can still transition to 'expired' — cancelled/deprecated/expired are already terminal for this purpose. */
const EXPIRABLE_STATUSES: RuleStatus[] = ['active', 'paused'];

function nowIso(): string {
  return new Date().toISOString();
}

export const RuleService = {
  /**
   * Latest version per lineage — what the Rules screen lists, and what materialization
   * treats as "the rules to consider". Lazily stamps 'expired' onto anything whose endDate
   * has passed (rule-usecase.xt: "let expired be stored") before returning.
   */
  async list(): Promise<RecurringRule[]> {
    const all = await ruleRepository.getAll();
    const latestByGroup = new Map<string, RecurringRule>();
    for (const rule of all) {
      const current = latestByGroup.get(rule.ruleGroupId);
      if (!current || rule.version > current.version) {
        latestByGroup.set(rule.ruleGroupId, rule);
      }
    }

    const today = todayDateString();
    const latest = [...latestByGroup.values()];
    await Promise.all(
      latest
        .filter((rule) => EXPIRABLE_STATUSES.includes(rule.status) && rule.endDate && rule.endDate < today)
        .map(async (rule) => {
          await ruleRepository.updateStatus(rule.id, 'expired');
          rule.status = 'expired'; // reflect immediately in what we're about to return
        }),
    );
    return latest;
  },

  /** Full version history for one lineage, ordered oldest first. */
  async getHistory(ruleGroupId: string): Promise<RecurringRule[]> {
    return ruleRepository.getByRuleGroupId(ruleGroupId);
  },

  /** One exact version by id — used to trace a materialized transaction back to what produced it. */
  async getVersion(ruleId: string): Promise<RecurringRule | undefined> {
    return ruleRepository.getById(ruleId);
  },

  async create(input: CreateRuleInput): Promise<RecurringRule> {
    const now = nowIso();
    const rule: RecurringRule = {
      id: createId(),
      ruleGroupId: createId(),
      version: 1,
      effectiveFrom: input.startDate,
      name: input.name,
      description: input.description,
      type: input.type,
      categoryId: input.categoryId,
      amount: input.amount,
      repeats: input.repeats,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await ruleRepository.save(rule);
    return rule;
  },

  /**
   * Content edit (§2.4): identity fields (name/categoryId/type) changing starts a new
   * lineage; anything else (amount, schedule) creates the next version in the same one.
   * The row being superseded is automatically force-set to a status regardless of what it
   * was — 'deprecated' for an in-lineage version bump, 'cancelled' for a chain-break
   * (rule-usecase.xt #2/#3). Status is never part of a revision — see setStatus.
   */
  async revise(ruleGroupId: string, changes: ReviseRuleInput): Promise<RecurringRule> {
    const history = await ruleRepository.getByRuleGroupId(ruleGroupId);
    const current = history[history.length - 1];
    if (!current) throw new Error(`No rule found for group ${ruleGroupId}`);

    const breaksChain = CHAIN_BREAKING_FIELDS.some((field) => {
      const next = changes[field];
      return next !== undefined && next !== current[field];
    });

    const now = nowIso();
    const effectiveFrom = changes.effectiveFrom ?? todayDateString();

    const revised: RecurringRule = {
      ...current,
      ...changes,
      id: createId(),
      ruleGroupId: breaksChain ? createId() : current.ruleGroupId,
      version: breaksChain ? 1 : current.version + 1,
      status: current.status, // inherited from the pre-supersede row, untouched by content edits
      effectiveFrom,
      effectiveTo: undefined,
      supersedesId: breaksChain ? undefined : current.id,
      createdAt: now,
      updatedAt: now,
    };

    if (breaksChain) {
      // Separate lineage, no shared date range — the old one is done, permanently.
      await ruleRepository.updateStatus(current.id, 'cancelled');
    } else {
      await ruleRepository.save({ ...current, effectiveTo: effectiveFrom, status: 'deprecated', updatedAt: now });
    }
    await ruleRepository.save(revised);
    return revised;
  },

  /** Pause/resume/cancel — an in-place status mutation on the current row, never a new version. */
  async setStatus(ruleGroupId: string, status: RuleStatus): Promise<RecurringRule> {
    const history = await ruleRepository.getByRuleGroupId(ruleGroupId);
    const current = history[history.length - 1];
    if (!current) throw new Error(`No rule found for group ${ruleGroupId}`);
    await ruleRepository.updateStatus(current.id, status);
    return { ...current, status };
  },

  /**
   * Hard-removes every version in the lineage. Already-completed transactions are left
   * untouched — they keep their ruleId/ruleGroupId for historical traceability even though
   * the rule record itself is gone. (Planned occurrences are never stored — see
   * RuleEngineService — so there's nothing else to clean up.)
   */
  async deleteLineage(ruleGroupId: string): Promise<void> {
    const history = await ruleRepository.getByRuleGroupId(ruleGroupId);
    await Promise.all(history.map((version) => ruleRepository.delete(version.id)));
  },
};
