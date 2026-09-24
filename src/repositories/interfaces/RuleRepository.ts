import type { RecurringRule } from '../../models/RecurringRule';

export interface RuleRepository {
  getAll(): Promise<RecurringRule[]>;
  getById(id: string): Promise<RecurringRule | undefined>;
  /** All versions in one lineage, ordered by version. */
  getByRuleGroupId(ruleGroupId: string): Promise<RecurringRule[]>;
  /** The version whose [effectiveFrom, effectiveTo) window covers the given date. */
  getActiveVersionAt(ruleGroupId: string, atDate: string): Promise<RecurringRule | undefined>;
  /** Insert-only — rules are immutable, never updated in place. */
  save(rule: RecurringRule): Promise<void>;
  delete(id: string): Promise<void>;
}
