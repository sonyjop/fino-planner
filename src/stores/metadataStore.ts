import { create } from 'zustand';
import type { MetadataGroup } from '../models/MetadataGroup';
import { MetadataService, type RemoveOutcome } from '../services/MetadataService';

interface MetadataState {
  groups: MetadataGroup[];
  loading: boolean;
  /** Seeds on first run (no-op afterward), then loads. */
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  createCategory: (input: { name: string; icon: string; color: string }) => Promise<MetadataGroup>;
  updateCategory: (id: string, changes: { name?: string; icon?: string; color?: string }) => Promise<void>;
  removeCategory: (id: string) => Promise<RemoveOutcome>;
  restoreCategory: (id: string) => Promise<void>;
  addItem: (groupId: string, input: { label: string; last4?: string }) => Promise<void>;
  updateItem: (itemId: string, changes: { label?: string; last4?: string }) => Promise<void>;
  removeItem: (itemId: string) => Promise<RemoveOutcome>;
  restoreItem: (itemId: string) => Promise<void>;
}

/**
 * Every mutation goes through MetadataService (validation, archive-vs-delete) and then
 * reloads, so pickers everywhere see the change immediately — no app reload needed.
 */
export const useMetadataStore = create<MetadataState>((set, get) => ({
  groups: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    await MetadataService.ensureSeeded();
    const groups = await MetadataService.list();
    set({ groups, loading: false });
  },

  refresh: async () => {
    const groups = await MetadataService.list();
    set({ groups });
  },

  createCategory: async (input) => {
    const group = await MetadataService.createCategory(input);
    await get().refresh();
    return group;
  },

  updateCategory: async (id, changes) => {
    await MetadataService.updateCategory(id, changes);
    await get().refresh();
  },

  removeCategory: async (id) => {
    const outcome = await MetadataService.removeCategory(id);
    await get().refresh();
    return outcome;
  },

  restoreCategory: async (id) => {
    await MetadataService.restoreCategory(id);
    await get().refresh();
  },

  addItem: async (groupId, input) => {
    await MetadataService.addItem(groupId, input);
    await get().refresh();
  },

  updateItem: async (itemId, changes) => {
    await MetadataService.updateItem(itemId, changes);
    await get().refresh();
  },

  removeItem: async (itemId) => {
    const outcome = await MetadataService.removeItem(itemId);
    await get().refresh();
    return outcome;
  },

  restoreItem: async (itemId) => {
    await MetadataService.restoreItem(itemId);
    await get().refresh();
  },
}));
