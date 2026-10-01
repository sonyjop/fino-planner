import type { ISODateString } from './common';

/**
 * Master Data is two two-level hierarchies built from the same primitive (architecture.md §2.2):
 * - 'category' groups (Housing, Essentials…) whose items are sub-categories — user-managed.
 * - 'paymentMode' groups — exactly six, fixed and system-defined — whose items are the
 *   user's instruments (cards, UPI handles, bank logins…).
 * Transactions and rules store only the leaf item id; the group is always derived.
 */
export type MetadataGroupKey = 'category' | 'paymentMode';

export type PaymentModeCode = 'creditCard' | 'debitCard' | 'upi' | 'netBanking' | 'cash' | 'wallet';

export interface MetadataItem {
  /** Globally unique, so a leaf id alone identifies its parent group. */
  id: string;
  /** Sub-category name or instrument nickname — unique among siblings, case-insensitive. */
  label: string;
  /** Instruments only: exactly 4 digits, shown as "label ••1234". Never a full number. */
  last4?: string;
  /** The built-in "Cash" instrument — cannot be renamed, archived or deleted. */
  isSystem?: boolean;
  order: number;
  archived: boolean;
  /** Stamped the first time any transaction or rule version references it; never cleared. */
  firstUsedAt?: ISODateString;
}

export interface MetadataGroup {
  id: string;
  key: MetadataGroupKey;
  /** paymentMode groups only — the fixed mode this group represents. */
  systemCode?: PaymentModeCode;
  name: string;
  icon: string;
  color: string;
  /** True for the six payment modes: cannot be added, renamed, reordered, archived or deleted. */
  isSystem: boolean;
  archived: boolean;
  /** Stamped when any of its items is first used; never cleared. */
  firstUsedAt?: ISODateString;
  items: MetadataItem[];
  order: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
