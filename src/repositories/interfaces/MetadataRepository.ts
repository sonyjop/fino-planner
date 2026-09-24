import type { MetadataGroup } from '../../models/MetadataGroup';

export interface MetadataRepository {
  getAll(): Promise<MetadataGroup[]>;
  getById(id: string): Promise<MetadataGroup | undefined>;
  /** All groups sharing a key, e.g. every 'category' group. */
  getByKey(key: string): Promise<MetadataGroup[]>;
  save(group: MetadataGroup): Promise<void>; // upsert
  delete(id: string): Promise<void>;
}
