import type { ISODateString, MonthKey, TransactionType } from './common';

export type TransactionStatusKind = 'planned' | 'actual';

export interface Transaction {
  id: string;
  title: string;
  /** What was planned. 0 when the transaction was created directly as completed (unplanned). */
  plannedAmount: number;
  /** What was actually paid/received. Set only while statusKind is 'actual'. */
  actualAmount?: number;
  type: TransactionType;
  /** -> MetadataItem.id under a 'category' group. The category itself is derived, never stored. */
  subCategoryId: string;
  date: ISODateString; // auto = entry date unless changed
  /** Structural marker deciding planned vs. actual bucketing & balance math — not user metadata. */
  statusKind: TransactionStatusKind;
  /** -> MetadataItem.id under a 'paymentMode' group. The payment mode itself is derived. */
  instrumentId?: string;
  notes?: string;
  /** Exact rule VERSION that spawned this, for traceability. */
  ruleId?: string;
  /** Full rule LINEAGE — survives rule edits/versioning. */
  ruleGroupId?: string;
  monthKey: MonthKey;
  year: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
