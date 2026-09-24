import type { ISODateString } from './common';

/**
 * 'category' is shared by many groups (Housing, Income, Essentials...) — each is its
 * own selectable category. 'account' / 'paymentMode' / 'status' each have exactly one
 * group with that key; the app looks them up by key, not by id.
 */
export type MetadataGroupKey = 'category' | 'account' | 'paymentMode' | 'status' | (string & {});

export interface MetadataItem {
  id: string;
  label: string;
  order: number;
  archived: boolean;
}

export interface MetadataGroup {
  id: string;
  key: MetadataGroupKey;
  name: string;
  icon: string;
  color: string;
  /** True for the group's *existence* being depended on by app logic (account/paymentMode/status). */
  isSystem: boolean;
  items: MetadataItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
