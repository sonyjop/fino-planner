import type { MetadataGroup, MetadataGroupKey } from '../models/MetadataGroup';
import { createId } from '../utils/id';

function group(
  name: string,
  key: MetadataGroupKey,
  icon: string,
  color: string,
  isSystem: boolean,
  items: string[],
): MetadataGroup {
  const now = new Date().toISOString();
  return {
    id: createId(),
    key,
    name,
    icon,
    color,
    isSystem,
    items: items.map((label, index) => ({ id: createId(), label, order: index, archived: false })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Starter Master Data, loaded once on first run (MetadataService.ensureSeeded).
 * Fully user-editable afterward — this is seed content, not a fixed structure.
 * Mirrors architecture.md's confirmed seed set.
 */
export function buildSeedMetadataGroups(): MetadataGroup[] {
  return [
    group('Housing', 'category', 'house', '#3355ee', false, [
      'House Rent',
      'Society Maintenance',
      'Property Tax',
      'Home Loan EMI',
    ]),
    group('Income', 'category', 'wallet', '#1a9e5c', false, [
      'Salary',
      'Freelance/Business Income',
      'Interest & Investment Income',
    ]),
    group('Essentials', 'category', 'basket', '#e8792b', false, [
      'Grocery',
      'Electricity & Water',
      'Cooking Gas',
      'Mobile & Internet',
      'Domestic Help',
      'Medical & Pharmacy',
    ]),
    group('Transport', 'category', 'car', '#c9a227', false, [
      'Fuel',
      'Public Transport',
      'Cab/Ride-hailing',
      'Vehicle Maintenance',
      'Parking & Tolls',
    ]),
    group('Protection', 'category', 'shield', '#3355ee', false, [
      'Life Insurance',
      'Health Insurance',
      'Vehicle Insurance',
    ]),
    group('Lifestyle', 'category', 'sparkle', '#e8792b', false, [
      'Dining Out',
      'OTT/Streaming Subscriptions',
      'Shopping & Apparel',
      'Travel & Vacation',
      'Gym & Fitness',
      'Personal Care',
      'Gifts & Donations',
      'Hobbies',
    ]),
    group('Payment Mode', 'paymentMode', 'card', '#6b7280', true, [
      'Credit Card',
      'UPI',
      'Net Banking',
      'Cash',
      'Wallet',
    ]),
    group('Account', 'account', 'bank', '#6b7280', true, []),
    group('Status', 'status', 'tag', '#6b7280', true, ['Planned', 'Partial', 'Paid']),
  ];
}
