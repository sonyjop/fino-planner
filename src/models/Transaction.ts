import type { ISODateString, MonthKey, TransactionType } from './common';

export type TransactionStatusKind = 'planned' | 'actual';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string; // -> MetadataGroup.id (a 'category'-key group)
  date: ISODateString; // auto = entry date unless changed
  /** Structural marker deciding planned vs. actual bucketing & balance math — not user metadata. */
  statusKind: TransactionStatusKind;
  /** Display label only -> MetadataItem.id in the 'status' group (Planned/Partial/Paid/...). */
  statusLabelId?: string;
  accountId?: string; // -> MetadataItem.id in the 'account' group
  paymentModeId?: string; // -> MetadataItem.id in the 'paymentMode' group
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
