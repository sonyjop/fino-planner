import { create } from 'zustand';

export type AppTab = 'cashflow' | 'rules' | 'masterData' | 'annualSummary';
export type SheetType = 'transaction' | 'rule' | 'category' | 'instrument';
export type SheetMode = 'create' | 'edit';

export interface ActiveSheet {
  type: SheetType;
  mode: SheetMode;
  targetId?: string;
  /** Create-mode parent, e.g. the payment mode a new instrument goes under. */
  parentId?: string;
}

interface UiState {
  activeTab: AppTab;
  activeSheet: ActiveSheet | null;
  setActiveTab: (tab: AppTab) => void;
  openSheet: (sheet: ActiveSheet) => void;
  closeSheet: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'cashflow',
  activeSheet: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
}));
