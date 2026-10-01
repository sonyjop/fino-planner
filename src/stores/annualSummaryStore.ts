import { create } from 'zustand';
import type { FiscalYearSummary } from '../models/FiscalYearSummary';
import { FiscalYearSummaryService } from '../services/FiscalYearSummaryService';
import { fiscalYearStart } from '../utils/date';

interface AnnualSummaryState {
  /** Survives tab switches — the screen unmounts, the store doesn't. */
  fyStartYear: number;
  summary: FiscalYearSummary | null;
  loading: boolean;
  load: (fyStartYear: number) => Promise<void>;
  go: (delta: number) => Promise<void>;
}

export const useAnnualSummaryStore = create<AnnualSummaryState>((set, get) => ({
  fyStartYear: fiscalYearStart(new Date()),
  summary: null,
  loading: false,

  load: async (fyStartYear) => {
    set({ loading: true, fyStartYear });
    const summary = await FiscalYearSummaryService.get(fyStartYear);
    // Ignore a slow response for a FY the user has already navigated away from.
    if (get().fyStartYear === fyStartYear) set({ summary, loading: false });
  },

  go: async (delta) => {
    await get().load(get().fyStartYear + delta);
  },
}));
