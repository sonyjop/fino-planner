import { create } from 'zustand';
import type { RecurringRule, RuleStatus } from '../models/RecurringRule';
import { RuleService, type CreateRuleInput, type ReviseRuleInput } from '../services/RuleService';

interface RuleState {
  rules: RecurringRule[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: CreateRuleInput) => Promise<void>;
  revise: (ruleGroupId: string, changes: ReviseRuleInput) => Promise<void>;
  setStatus: (ruleGroupId: string, status: RuleStatus) => Promise<void>;
  remove: (ruleGroupId: string) => Promise<void>;
}

export const useRuleStore = create<RuleState>((set, get) => ({
  rules: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const rules = await RuleService.list();
    set({ rules, loading: false });
  },

  create: async (input) => {
    await RuleService.create(input);
    await get().load();
  },

  revise: async (ruleGroupId, changes) => {
    await RuleService.revise(ruleGroupId, changes);
    await get().load();
  },

  setStatus: async (ruleGroupId, status) => {
    await RuleService.setStatus(ruleGroupId, status);
    await get().load();
  },

  remove: async (ruleGroupId) => {
    await RuleService.deleteLineage(ruleGroupId);
    await get().load();
  },
}));
