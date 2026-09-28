import { buildSeedMetadataGroups } from '../data/seedMetadata';
import type { MetadataGroup, MetadataGroupKey, MetadataItem } from '../models/MetadataGroup';
import { metadataRepository } from '../repositories';
import { createId } from '../utils/id';

function nowIso(): string {
  return new Date().toISOString();
}

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

  async getByKey(key: MetadataGroupKey): Promise<MetadataGroup[]> {
    return metadataRepository.getByKey(key);
  },

  async createGroup(input: { name: string; icon: string; color: string }): Promise<MetadataGroup> {
    const now = nowIso();
    const group: MetadataGroup = {
      id: createId(),
      key: 'category',
      name: input.name,
      icon: input.icon,
      color: input.color,
      isSystem: false,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await metadataRepository.save(group);
    return group;
  },

  async updateGroup(
    id: string,
    changes: Partial<Pick<MetadataGroup, 'name' | 'icon' | 'color'>>,
  ): Promise<MetadataGroup> {
    const existing = await metadataRepository.getById(id);
    if (!existing) throw new Error(`Metadata group ${id} not found`);
    const updated: MetadataGroup = { ...existing, ...changes, updatedAt: nowIso() };
    await metadataRepository.save(updated);
    return updated;
  },

  async deleteGroup(id: string): Promise<void> {
    const existing = await metadataRepository.getById(id);
    if (existing?.isSystem) throw new Error(`Cannot delete system group "${existing.name}"`);
    await metadataRepository.delete(id);
  },

  async addItem(groupId: string, label: string): Promise<MetadataGroup> {
    const group = await metadataRepository.getById(groupId);
    if (!group) throw new Error(`Metadata group ${groupId} not found`);
    const item: MetadataItem = { id: createId(), label, order: group.items.length, archived: false };
    const updated: MetadataGroup = { ...group, items: [...group.items, item], updatedAt: nowIso() };
    await metadataRepository.save(updated);
    return updated;
  },

  /** Soft-delete only — archived items stay resolvable for historical transactions (models/MetadataGroup.ts). */
  async archiveItem(groupId: string, itemId: string): Promise<MetadataGroup> {
    const group = await metadataRepository.getById(groupId);
    if (!group) throw new Error(`Metadata group ${groupId} not found`);
    const updated: MetadataGroup = {
      ...group,
      items: group.items.map((item) => (item.id === itemId ? { ...item, archived: true } : item)),
      updatedAt: nowIso(),
    };
    await metadataRepository.save(updated);
    return updated;
  },
};
