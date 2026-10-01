import type { ISODateString, TransactionType } from './common';

export type RuleCadence = 'monthly' | 'quarterly' | 'yearly';

/**
 * - active — normal; contributes computed planned occurrences going forward.
 * - paused — user-suspended; contributes nothing until resumed. In-place status mutation.
 * - cancelled — user-cancelled, OR the automatic terminal state of a lineage's row after a
 *   chain-break (name/category/type change) spins off a replacement. In-place mutation either way.
 * - deprecated — automatic: this version was superseded by a newer one in the same lineage.
 *   Still contributes occurrences for any "gap" months its [effectiveFrom, effectiveTo) window
 *   covers that the newer version doesn't reach yet.
 * - expired — automatic: today has passed this rule's own configured `endDate`. Informational —
 *   the endDate itself already bounds which months produce an occurrence (see RuleEngineService),
 *   so this status doesn't need to gate anything further; RuleService.list() stamps it in place
 *   the first time it notices, rather than computing it fresh each time (rule-usecase.xt: "let
 *   expired be stored").
 */
export type RuleStatus = 'active' | 'paused' | 'cancelled' | 'deprecated' | 'expired';

/**
 * Rules are immutable and versioned. Every content edit produces a new row:
 * - amount / schedule changing -> a new version, same ruleGroupId, old row -> 'deprecated'
 * - name / subCategoryId / type changing -> a brand-new ruleGroupId (chain break), old row -> 'cancelled'
 *
 * Status (active/paused/cancelled) is the one exception — it mutates in place, never versions
 * (see RuleRepository.updateStatus). RuleRepository's `save` is otherwise insert-only.
 */
export interface RecurringRule {
  id: string; // unique per version
  ruleGroupId: string; // stable across versions in one lineage
  version: number; // 1-based within the group
  effectiveFrom: ISODateString;
  effectiveTo?: ISODateString; // exclusive; set once superseded within the same lineage
  supersedesId?: string; // previous version's id, same group

  name: string; // chain-breaking if changed
  description?: string; // cosmetic — non-breaking
  type: TransactionType; // chain-breaking if changed
  subCategoryId: string; // chain-breaking if changed ("tag"); category derived
  instrumentId?: string; // versions, doesn't break chain; pre-fills completed occurrences

  amount: number; // versions, doesn't break chain
  repeats: RuleCadence;
  dayOfMonth?: number; // for 'monthly' and 'quarterly'
  monthOfYear?: number; // 'yearly': the month it fires in. 'quarterly': the start month (fires every 3rd month from here)
  startDate: ISODateString;
  /** Undefined = never-ending. Bounds which months produce an occurrence (rule-usecase.xt B). */
  endDate?: ISODateString;
  status: RuleStatus; // versions, doesn't break chain

  createdAt: ISODateString;
  updatedAt: ISODateString;
}
