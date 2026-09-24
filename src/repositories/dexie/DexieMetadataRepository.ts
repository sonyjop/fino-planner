import type { MetadataGroup } from '../../models/MetadataGroup';
import type { MetadataRepository } from '../interfaces/MetadataRepository';
import { db } from './db';

/**
 * No encryption here by design (architecture.md §8.1/§8.3) — Master Data holds
 * labels and enum values, no monetary figures, so it's stored in the clear and
 * implements the domain interface directly (no Encrypting wrapper needed).
 */
export class DexieMetadataRepository implements MetadataRepository {
  async getAll(): Promise<MetadataGroup[]> {
    return db.metadataGroups.toArray();
  }

  async getById(id: string): Promise<MetadataGroup | undefined> {
    return db.metadataGroups.get(id);
  }

  async getByKey(key: string): Promise<MetadataGroup[]> {
    return db.metadataGroups.where('key').equals(key).toArray();
  }

  async save(group: MetadataGroup): Promise<void> {
    await db.metadataGroups.put(group);
  }

  async delete(id: string): Promise<void> {
    await db.metadataGroups.delete(id);
  }
}
