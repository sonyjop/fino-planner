import { create } from 'zustand';
import type { Transaction } from '../models/Transaction';
import { TransactionService, type CreateTransactionInput } from '../services/TransactionService';

interface TransactionState {
  year: number;
  month: number; // 1-based
  transactions: Transaction[];
  loading: boolean;
  loadMonth: (year: number, month: number) => Promise<void>;
  create: (input: CreateTransactionInput) => Promise<void>;
  update: (id: string, changes: Partial<CreateTransactionInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const now = new Date();

export const useTransactionStore = create<TransactionState>((set, get) => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  transactions: [],
  loading: false,

  loadMonth: async (year, month) => {
    set({ loading: true, year, month });
    const transactions = await TransactionService.getForMonth(year, month);
    set({ transactions, loading: false });
  },

  create: async (input) => {
    await TransactionService.create(input);
    await get().loadMonth(get().year, get().month);
  },

  update: async (id, changes) => {
    await TransactionService.update(id, changes);
    await get().loadMonth(get().year, get().month);
  },

  remove: async (id) => {
    await TransactionService.delete(id);
    await get().loadMonth(get().year, get().month);
  },
}));
