import type { MetadataGroup, MetadataGroupKey, MetadataItem } from '../models/MetadataGroup';

export interface ResolvedLeaf {
  group: MetadataGroup;
  item: MetadataItem;
}

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

const leafIndexCache = new WeakMap<MetadataGroup[], Map<string, ResolvedLeaf>>();

/** item id -> { group, item }, built once per groups array (stores replace the array on change). */
function leafIndex(groups: MetadataGroup[]): Map<string, ResolvedLeaf> {
  let index = leafIndexCache.get(groups);
  if (!index) {
    index = new Map();
    for (const group of groups) for (const item of group.items) index.set(item.id, { group, item });
    leafIndexCache.set(groups, index);
  }
  return index;
}

/**
 * Transactions and rules store only the leaf (sub-category / instrument); the parent is always
 * derived here (architecture.md §2.2). Archived entries still resolve — history keeps its names.
 */
export function resolveLeaf(groups: MetadataGroup[], itemId: string | undefined): ResolvedLeaf | undefined {
  return itemId ? leafIndex(groups).get(itemId) : undefined;
}

export function groupsByKey(groups: MetadataGroup[], key: MetadataGroupKey): MetadataGroup[] {
  return groups.filter((g) => g.key === key).sort(byOrder);
}

export interface PickerGroup {
  group: MetadataGroup;
  items: MetadataItem[];
}

/**
 * What a picker offers: active items under active groups, in Master Data order. Groups with
 * nothing pickable are left out. `currentId` keeps an already-chosen but since-archived value
 * selectable, so editing a record never silently drops it.
 */
export function pickableLeaves(groups: MetadataGroup[], key: MetadataGroupKey, currentId?: string): PickerGroup[] {
  return groupsByKey(groups, key)
    .map((group) => ({
      group,
      items: group.items
        .filter((item) => item.id === currentId || (!item.archived && !group.archived))
        .sort(byOrder),
    }))
    .filter((entry) => entry.items.length > 0);
}

/** "HDFC Regalia ••4321", or just the nickname when no last 4 digits were given. */
export function formatInstrument(item: MetadataItem): string {
  return item.last4 ? `${item.label} ••${item.last4}` : item.label;
}

/** "Housing › House Rent" — or "Uncategorised" when the id resolves to nothing. */
export function describeSubCategory(groups: MetadataGroup[], subCategoryId: string | undefined): string {
  const leaf = resolveLeaf(groups, subCategoryId);
  return leaf?.group.key === 'category' ? `${leaf.group.name} › ${leaf.item.label}` : 'Uncategorised';
}

/** Picker groups for GroupedSelectField: sub-categories under category names, instruments under modes. */
export function leafOptions(
  groups: MetadataGroup[],
  key: MetadataGroupKey,
  currentId?: string,
): { label: string; options: { value: string; label: string }[] }[] {
  return pickableLeaves(groups, key, currentId).map(({ group, items }) => ({
    label: group.name,
    options: items.map((item) => ({
      value: item.id,
      label: (key === 'paymentMode' ? formatInstrument(item) : item.label) + (item.archived ? ' (archived)' : ''),
    })),
  }));
}

/** "Credit Card · HDFC Regalia ••4321" — the derived payment mode shown with the instrument. */
export function describeInstrument(groups: MetadataGroup[], instrumentId: string | undefined): string | undefined {
  const leaf = resolveLeaf(groups, instrumentId);
  return leaf?.group.key === 'paymentMode' ? `${leaf.group.name} · ${formatInstrument(leaf.item)}` : undefined;
}
