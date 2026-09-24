import type { ISODateString, TransactionType } from './common';

export type RuleCadence = 'monthly' | 'weekly' | 'yearly';
export type RuleStatus = 'active' | 'paused' | 'stopped';

/**
 * Rules are immutable and versioned. Every edit produces a new row:
 * - amount / schedule / status changing -> a new version, same ruleGroupId
 * - name / categoryId / type changing -> a brand-new ruleGroupId (chain breaks)
 *
 * RuleRepository never exposes an update — only inserts (see interfaces/RuleRepository.ts).
 */
export interface RecurringRule {
  id: string; // unique per version
  ruleGroupId: string; // stable across versions in one lineage
  version: number; // 1-based within the group
  effectiveFrom: ISODateString;
  effectiveTo?: ISODateString; // exclusive; set once superseded
  supersedesId?: string; // previous version's id, same group

  name: string; // chain-breaking if changed
  description?: string; // cosmetic — non-breaking
  type: TransactionType; // chain-breaking if changed
  categoryId: string; // chain-breaking if changed ("tag")

  amount: number; // versions, doesn't break chain
  repeats: RuleCadence;
  dayOfMonth?: number; // for 'monthly'
  dayOfWeek?: number; // for 'weekly'
  monthOfYear?: number; // for 'yearly', paired with dayOfMonth
  startDate: ISODateString;
  status: RuleStatus; // versions, doesn't break chain

  createdAt: ISODateString;
  updatedAt: ISODateString;
}
