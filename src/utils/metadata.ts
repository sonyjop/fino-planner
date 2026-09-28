import type { MetadataGroup } from '../models/MetadataGroup';

export function findCategoryGroup(groups: MetadataGroup[], categoryId: string): MetadataGroup | undefined {
  return groups.find((g) => g.id === categoryId);
}

export function getCategoryGroups(groups: MetadataGroup[]): MetadataGroup[] {
  return groups.filter((g) => g.key === 'category');
}

export function findGroupByKey(groups: MetadataGroup[], key: string): MetadataGroup | undefined {
  return groups.find((g) => g.key === key);
}

export function resolveItemLabel(groups: MetadataGroup[], groupKey: string, itemId?: string): string | undefined {
  if (!itemId) return undefined;
  return findGroupByKey(groups, groupKey)?.items.find((item) => item.id === itemId)?.label;
}

export function resolveItemIdByLabel(groups: MetadataGroup[], groupKey: string, label: string): string | undefined {
  const group = findGroupByKey(groups, groupKey);
  return group?.items.find((item) => item.label.toLowerCase() === label.toLowerCase())?.id;
}
