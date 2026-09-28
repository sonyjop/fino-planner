import { create } from 'zustand';
import type { MetadataGroup } from '../models/MetadataGroup';
import { MetadataService } from '../services/MetadataService';

interface MetadataState {
  groups: MetadataGroup[];
  loading: boolean;
  /** Seeds on first run (no-op afterward), then loads. */
  load: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useMetadataStore = create<MetadataState>((set) => ({
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
}));
