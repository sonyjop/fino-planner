import { create } from 'zustand';

interface AuthState {
  isUnlocked: boolean;
  setUnlocked: (value: boolean) => void;
}

/** UI-bound flag only — the actual session key lives in CryptoService, never here. */
export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,
  setUnlocked: (value) => set({ isUnlocked: value }),
}));
