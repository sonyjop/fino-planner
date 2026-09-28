import type { RecurringRule, RuleStatus } from '../../models/RecurringRule';

export interface RuleRepository {
  getAll(): Promise<RecurringRule[]>;
  getById(id: string): Promise<RecurringRule | undefined>;
  /** All versions in one lineage, ordered by version. */
  getByRuleGroupId(ruleGroupId: string): Promise<RecurringRule[]>;
  /** The version whose [effectiveFrom, effectiveTo) window covers the given date. */
  getActiveVersionAt(ruleGroupId: string, atDate: string): Promise<RecurringRule | undefined>;
  /** Insert-only for content — rules are immutable, never updated in place except status. */
  save(rule: RecurringRule): Promise<void>;
  /** The one deliberate exception to immutability — see architecture.md §2.4. */
  updateStatus(id: string, status: RuleStatus): Promise<void>;
  delete(id: string): Promise<void>;
}
