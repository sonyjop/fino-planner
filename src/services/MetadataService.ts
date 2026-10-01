import { buildSeedMetadataGroups } from '../data/seedMetadata';
import type { MetadataGroup, MetadataItem } from '../models/MetadataGroup';
import { metadataRepository } from '../repositories';
import { createId } from '../utils/id';

function nowIso(): string {
  return new Date().toISOString();
}

export class MetadataValidationError extends Error {}

const FULL_NUMBER_MESSAGE = "Don't store full card or account numbers — use a nickname and the last 4 digits";

/**
 * Pure. Master Data is stored unencrypted (architecture.md §8.1), so a label may never carry
 * something that looks like a full card/account number, and names must be unique among siblings.
 */
export function validateLabel(
  label: string,
  siblings: { id: string; label: string; archived?: boolean }[],
  selfId?: string,
): string {
  const trimmed = label.trim();
  if (!trimmed) throw new MetadataValidationError('Enter a name');
  // "4532 0151 1283 0366" / "4532-0151-…" are still full numbers — ignore separators between digits.
  if (/\d{5,}/.test(trimmed.replace(/(?<=\d)[\s.-]+(?=\d)/g, ''))) throw new MetadataValidationError(FULL_NUMBER_MESSAGE);
  const clash = siblings.find((s) => s.id !== selfId && s.label.trim().toLowerCase() === trimmed.toLowerCase());
  if (clash?.archived) throw new MetadataValidationError(`An archived entry named “${clash.label}” exists — restore it instead`);
  if (clash) throw new MetadataValidationError('DUPLICATE');
  return trimmed;
}

export function validateLast4(last4: string | undefined): string | undefined {
  const value = last4?.trim();
  if (!value) return undefined;
  if (!/^\d{4}$/.test(value)) throw new MetadataValidationError('Enter exactly the last 4 digits');
  return value;
}

async function getGroup(id: string): Promise<MetadataGroup> {
  const group = await metadataRepository.getById(id);
  if (!group) throw new Error(`Metadata group ${id} not found`);
  return group;
}

async function findItem(itemId: string): Promise<{ group: MetadataGroup; item: MetadataItem }> {
  for (const group of await metadataRepository.getAll()) {
    const item = group.items.find((i) => i.id === itemId);
    if (item) return { group, item };
  }
  throw new Error(`Metadata item ${itemId} not found`);
}

function assertEditableGroup(group: MetadataGroup): void {
  if (group.isSystem) throw new MetadataValidationError(`"${group.name}" is a fixed payment mode and can't be changed`);
}

function assertEditableItem(item: MetadataItem): void {
  if (item.isSystem) throw new MetadataValidationError(`"${item.label}" is built in and can't be changed`);
}

function itemNoun(group: MetadataGroup): string {
  return group.key === 'category' ? 'sub-category' : 'instrument';
}

function validateItemLabel(group: MetadataGroup, label: string, selfId?: string): string {
  try {
    return validateLabel(label, group.items, selfId);
  } catch (error) {
    if (error instanceof MetadataValidationError && error.message === 'DUPLICATE') {
      throw new MetadataValidationError(`A ${itemNoun(group)} with this name already exists in ${group.name}`);
    }
    throw error;
  }
}

async function saveGroup(group: MetadataGroup): Promise<MetadataGroup> {
  const updated = { ...group, updatedAt: nowIso() };
  await metadataRepository.save(updated);
  return updated;
}

export type RemoveOutcome = 'archived' | 'deleted';

export const MetadataService = {
  /** Loads default groups on first run only — never overwrites existing data. */
  async ensureSeeded(): Promise<void> {
    const existing = await metadataRepository.getAll();
    if (existing.length > 0) return;
    for (const group of buildSeedMetadataGroups()) {
      await metadataRepository.save(group);
    }
  },

  async list(): Promise<MetadataGroup[]> {
    return metadataRepository.getAll();
  },

  // --- Categories ---

  async createCategory(input: { name: string; icon: string; color: string }): Promise<MetadataGroup> {
    const categories = await metadataRepository.getByKey('category');
    let name: string;
    try {
      name = validateLabel(input.name, categories.map((g) => ({ id: g.id, label: g.name, archived: g.archived })));
    } catch (error) {
      if (error instanceof MetadataValidationError && error.message === 'DUPLICATE') {
        throw new MetadataValidationError('A category with this name already exists');
      }
      throw error;
    }
    const now = nowIso();
    const group: MetadataGroup = {
      id: createId(),
      key: 'category',
      name,
      icon: input.icon,
      color: input.color,
      isSystem: false,
      archived: false,
      items: [],
      order: categories.reduce((max, g) => Math.max(max, g.order + 1), 0),
      createdAt: now,
      updatedAt: now,
    };
    await metadataRepository.save(group);
    return group;
  },

  async updateCategory(id: string, changes: { name?: string; icon?: string; color?: string }): Promise<MetadataGroup> {
    const group = await getGroup(id);
    assertEditableGroup(group);
    let name = group.name;
    if (changes.name !== undefined) {
      const categories = await metadataRepository.getByKey('category');
      try {
        name = validateLabel(changes.name, categories.map((g) => ({ id: g.id, label: g.name, archived: g.archived })), id);
      } catch (error) {
        if (error instanceof MetadataValidationError && error.message === 'DUPLICATE') {
          throw new MetadataValidationError('A category with this name already exists');
        }
        throw error;
      }
    }
    return saveGroup({ ...group, name, icon: changes.icon ?? group.icon, color: changes.color ?? group.color });
  },

  /** Used -> archive the category and all its sub-categories. Never used -> delete permanently. */
  async removeCategory(id: string): Promise<RemoveOutcome> {
    const group = await getGroup(id);
    assertEditableGroup(group);
    if (!group.firstUsedAt) {
      await metadataRepository.delete(id);
      return 'deleted';
    }
    await saveGroup({ ...group, archived: true, items: group.items.map((i) => ({ ...i, archived: true })) });
    return 'archived';
  },

  async restoreCategory(id: string): Promise<MetadataGroup> {
    const group = await getGroup(id);
    return saveGroup({ ...group, archived: false, items: group.items.map((i) => ({ ...i, archived: false })) });
  },

  // --- Sub-categories and instruments (items) ---

  async addItem(groupId: string, input: { label: string; last4?: string }): Promise<MetadataGroup> {
    const group = await getGroup(groupId);
    if (group.archived) throw new MetadataValidationError(`Restore ${group.name} before adding to it`);
    const label = validateItemLabel(group, input.label);
    const last4 = group.key === 'paymentMode' ? validateLast4(input.last4) : undefined;
    const item: MetadataItem = {
      id: createId(),
      label,
      ...(last4 ? { last4 } : {}),
      order: group.items.reduce((max, i) => Math.max(max, i.order + 1), 0),
      archived: false,
    };
    return saveGroup({ ...group, items: [...group.items, item] });
  },

  async updateItem(itemId: string, changes: { label?: string; last4?: string }): Promise<MetadataGroup> {
    const { group, item } = await findItem(itemId);
    assertEditableItem(item);
    const label = changes.label !== undefined ? validateItemLabel(group, changes.label, itemId) : item.label;
    const last4 =
      group.key === 'paymentMode' && changes.last4 !== undefined ? validateLast4(changes.last4) : item.last4;
    const updated: MetadataItem = { ...item, label, last4 };
    if (!last4) delete updated.last4;
    return saveGroup({ ...group, items: group.items.map((i) => (i.id === itemId ? updated : i)) });
  },

  /** Used -> archive (hidden from pickers, history keeps it). Never used -> delete permanently. */
  async removeItem(itemId: string): Promise<RemoveOutcome> {
    const { group, item } = await findItem(itemId);
    assertEditableItem(item);
    if (!item.firstUsedAt) {
      await saveGroup({ ...group, items: group.items.filter((i) => i.id !== itemId) });
      return 'deleted';
    }
    await saveGroup({ ...group, items: group.items.map((i) => (i.id === itemId ? { ...i, archived: true } : i)) });
    return 'archived';
  },

  /** Restoring a sub-category under an archived category restores the category too. */
  async restoreItem(itemId: string): Promise<MetadataGroup> {
    const { group } = await findItem(itemId);
    return saveGroup({
      ...group,
      archived: false,
      items: group.items.map((i) => (i.id === itemId ? { ...i, archived: false } : i)),
    });
  },

  /**
   * Stamps firstUsedAt on each referenced item and its group the first time it's used. Never
   * cleared — so "ever used" survives deleting the transaction that used it (architecture.md §2.2).
   */
  async markUsed(itemIds: (string | undefined)[]): Promise<void> {
    const ids = new Set(itemIds.filter((id): id is string => Boolean(id)));
    if (ids.size === 0) return;
    const now = nowIso();
    for (const group of await metadataRepository.getAll()) {
      let changed = false;
      const items = group.items.map((item) => {
        if (!ids.has(item.id) || item.firstUsedAt) return item;
        changed = true;
        return { ...item, firstUsedAt: now };
      });
      const groupUsed = group.items.some((i) => ids.has(i.id));
      if (groupUsed && !group.firstUsedAt) changed = true;
      if (changed) {
        await metadataRepository.save({ ...group, items, firstUsedAt: group.firstUsedAt ?? now, updatedAt: now });
      }
    }
  },
};
