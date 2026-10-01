import type { MetadataGroup, PaymentModeCode } from '../models/MetadataGroup';
import { createId } from '../utils/id';

function categoryGroup(name: string, icon: string, color: string, order: number, items: string[]): MetadataGroup {
  const now = new Date().toISOString();
  return {
    id: createId(),
    key: 'category',
    name,
    icon,
    color,
    isSystem: false,
    archived: false,
    items: items.map((label, index) => ({ id: createId(), label, order: index, archived: false })),
    order,
    createdAt: now,
    updatedAt: now,
  };
}

function paymentModeGroup(systemCode: PaymentModeCode, name: string, icon: string, order: number): MetadataGroup {
  const now = new Date().toISOString();
  return {
    id: createId(),
    key: 'paymentMode',
    systemCode,
    name,
    icon,
    color: '#6b7280',
    isSystem: true,
    archived: false,
    // Cash has nothing specific to pick, so it ships with one permanent instrument.
    items: systemCode === 'cash' ? [{ id: createId(), label: 'Cash', order: 0, archived: false, isSystem: true }] : [],
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/** The fixed, system-defined payment modes, in display order (master-data.feature). */
export const PAYMENT_MODES: { code: PaymentModeCode; name: string; icon: string }[] = [
  { code: 'creditCard', name: 'Credit Card', icon: 'card' },
  { code: 'debitCard', name: 'Debit Card', icon: 'card' },
  { code: 'upi', name: 'UPI', icon: 'wallet' },
  { code: 'netBanking', name: 'Net Banking', icon: 'bank' },
  { code: 'cash', name: 'Cash', icon: 'wallet' },
  { code: 'wallet', name: 'Wallet', icon: 'wallet' },
];

/**
 * Starter Master Data, loaded once on first run (MetadataService.ensureSeeded).
 * Categories are fully user-editable afterward; the payment modes are fixed.
 */
export function buildSeedMetadataGroups(): MetadataGroup[] {
  return [
    categoryGroup('Housing', 'house', '#3355ee', 0, ['House Rent', 'Society Maintenance', 'Property Tax', 'Home Loan EMI']),
    categoryGroup('Income', 'wallet', '#1a9e5c', 1, ['Salary', 'Freelance/Business Income', 'Interest & Investment Income']),
    categoryGroup('Essentials', 'basket', '#e8792b', 2, [
      'Grocery',
      'Electricity & Water',
      'Cooking Gas',
      'Mobile & Internet',
      'Domestic Help',
      'Medical & Pharmacy',
    ]),
    categoryGroup('Transport', 'car', '#c9a227', 3, [
      'Fuel',
      'Public Transport',
      'Cab/Ride-hailing',
      'Vehicle Maintenance',
      'Parking & Tolls',
    ]),
    categoryGroup('Protection', 'shield', '#3355ee', 4, ['Life Insurance', 'Health Insurance', 'Vehicle Insurance']),
    categoryGroup('Lifestyle', 'sparkle', '#e8792b', 5, [
      'Dining Out',
      'OTT/Streaming Subscriptions',
      'Shopping & Apparel',
      'Travel & Vacation',
      'Gym & Fitness',
      'Personal Care',
      'Gifts & Donations',
      'Hobbies',
    ]),
    ...PAYMENT_MODES.map((mode, index) => paymentModeGroup(mode.code, mode.name, mode.icon, index)),
  ];
}
