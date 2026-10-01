import { beforeEach, describe, expect, it } from 'vitest';
import type { MetadataGroup } from '../models/MetadataGroup';
import { setUpTestDatabase } from '../test/dbTestUtils';
import { groupsByKey, pickableLeaves, resolveLeaf } from '../utils/metadata';
import { MetadataService, validateLabel } from './MetadataService';
import { RuleService } from './RuleService';
import { TransactionService } from './TransactionService';

setUpTestDatabase();

async function groups(): Promise<MetadataGroup[]> {
  return MetadataService.list();
}

async function category(name: string): Promise<MetadataGroup> {
  const found = (await groups()).find((g) => g.key === 'category' && g.name === name);
  if (!found) throw new Error(`no category ${name}`);
  return found;
}

async function mode(name: string): Promise<MetadataGroup> {
  const found = (await groups()).find((g) => g.key === 'paymentMode' && g.name === name);
  if (!found) throw new Error(`no mode ${name}`);
  return found;
}

async function itemId(groupName: string, label: string): Promise<string> {
  const g = (await groups()).find((x) => x.name === groupName);
  const item = g?.items.find((i) => i.label === label);
  if (!item) throw new Error(`no ${groupName} › ${label}`);
  return item.id;
}

describe('MetadataService', () => {
  beforeEach(async () => {
    await MetadataService.ensureSeeded();
  });

  describe('seed', () => {
    it('loads starter categories with sub-categories, six fixed payment modes and a system Cash instrument', async () => {
      const all = await groups();
      expect((await category('Housing')).items.map((i) => i.label)).toContain('House Rent');
      expect(groupsByKey(all, 'paymentMode').map((g) => g.name)).toEqual([
        'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Cash', 'Wallet',
      ]);
      const cash = await mode('Cash');
      expect(cash.items).toEqual([expect.objectContaining({ label: 'Cash', isSystem: true })]);
      expect(all.some((g) => (g.key as string) === 'status' || (g.key as string) === 'account')).toBe(false);
    });

    it('never re-seeds over existing data', async () => {
      const housing = await category('Housing');
      await MetadataService.updateCategory(housing.id, { name: 'Home' });
      await MetadataService.ensureSeeded();
      const all = await groups();
      expect(all.filter((g) => g.name === 'Housing')).toHaveLength(0);
      expect(all.filter((g) => g.name === 'Home')).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('rejects a duplicate sibling name, ignoring case', async () => {
      const essentials = await category('Essentials');
      await expect(MetadataService.addItem(essentials.id, { label: 'grocery' })).rejects.toThrow(
        'A sub-category with this name already exists in Essentials',
      );
    });

    it('allows the same name under a different parent', async () => {
      await MetadataService.addItem((await category('Essentials')).id, { label: 'Insurance' });
      await MetadataService.addItem((await category('Protection')).id, { label: 'Insurance' });
      expect((await category('Essentials')).items.some((i) => i.label === 'Insurance')).toBe(true);
      expect((await category('Protection')).items.some((i) => i.label === 'Insurance')).toBe(true);
    });

    it('accepts an instrument with exactly 4 digits and rejects anything else', async () => {
      const credit = await mode('Credit Card');
      await MetadataService.addItem(credit.id, { label: 'HDFC Regalia', last4: '4321' });
      expect((await mode('Credit Card')).items[0]).toMatchObject({ label: 'HDFC Regalia', last4: '4321' });
      await expect(MetadataService.addItem(credit.id, { label: 'Amex', last4: '43210' })).rejects.toThrow(
        'Enter exactly the last 4 digits',
      );
      await expect(MetadataService.addItem(credit.id, { label: 'Amex', last4: '43a1' })).rejects.toThrow(
        'Enter exactly the last 4 digits',
      );
    });

    it('never saves something that looks like a full card or account number', async () => {
      const credit = await mode('Credit Card');
      await expect(MetadataService.addItem(credit.id, { label: 'Regalia 4532015112830366' })).rejects.toThrow(
        "Don't store full card or account numbers — use a nickname and the last 4 digits",
      );
      await expect(MetadataService.addItem(credit.id, { label: 'Regalia 4532 0151 1283 0366' })).rejects.toThrow(/full card/);
      await expect(MetadataService.addItem(credit.id, { label: 'Regalia 4532-0151-1283-0366' })).rejects.toThrow(/full card/);
      expect(validateLabel('GPay (SBI 1234)', [])).toBe('GPay (SBI 1234)');
    });

    it('refuses to change a fixed payment mode or the built-in Cash instrument', async () => {
      const upi = await mode('UPI');
      await expect(MetadataService.updateCategory(upi.id, { name: 'Unified' })).rejects.toThrow(/fixed payment mode/);
      await expect(MetadataService.removeCategory(upi.id)).rejects.toThrow(/fixed payment mode/);
      const cashId = await itemId('Cash', 'Cash');
      await expect(MetadataService.updateItem(cashId, { label: 'Notes' })).rejects.toThrow(/built in/);
      await expect(MetadataService.removeItem(cashId)).rejects.toThrow(/built in/);
    });
  });

  describe('archive, restore and delete', () => {
    it('deletes a never-used sub-category permanently', async () => {
      const id = await itemId('Lifestyle', 'Hobbies');
      expect(await MetadataService.removeItem(id)).toBe('deleted');
      expect(resolveLeaf(await groups(), id)).toBeUndefined();
    });

    it('archives a used sub-category — still resolvable, with its name, for history', async () => {
      const id = await itemId('Essentials', 'Domestic Help');
      await TransactionService.create({ title: 'Maid', type: 'expense', subCategoryId: id, plannedAmount: 4000 });
      expect(await MetadataService.removeItem(id)).toBe('archived');
      const leaf = resolveLeaf(await groups(), id);
      expect(leaf?.item).toMatchObject({ label: 'Domestic Help', archived: true });
    });

    it('treats a sub-category as used even after the transaction that used it is deleted', async () => {
      const id = await itemId('Essentials', 'Cooking Gas');
      const tx = await TransactionService.create({ title: 'Gas', type: 'expense', subCategoryId: id, plannedAmount: 900 });
      await TransactionService.delete(tx.id);
      expect(await MetadataService.removeItem(id)).toBe('archived');
    });

    it('stamps use from rule versions too, including the instrument', async () => {
      const subCategoryId = await itemId('Lifestyle', 'Gym & Fitness');
      const credit = await mode('Credit Card');
      await MetadataService.addItem(credit.id, { label: 'Regalia', last4: '4321' });
      const instrumentId = await itemId('Credit Card', 'Regalia');
      await RuleService.create({
        name: 'Gym', type: 'expense', subCategoryId, instrumentId, amount: 2000, repeats: 'monthly', dayOfMonth: 1, startDate: '2026-04-01',
      });
      expect(await MetadataService.removeItem(subCategoryId)).toBe('archived');
      expect(await MetadataService.removeItem(instrumentId)).toBe('archived');
    });

    it('archiving a used category archives all its sub-categories', async () => {
      const transport = await category('Transport');
      await TransactionService.create({ title: 'Fuel', type: 'expense', subCategoryId: transport.items[0].id, plannedAmount: 3000 });
      expect(await MetadataService.removeCategory(transport.id)).toBe('archived');
      const after = await category('Transport');
      expect(after.archived).toBe(true);
      expect(after.items.every((i) => i.archived)).toBe(true);
    });

    it('deletes a never-used category permanently', async () => {
      const created = await MetadataService.createCategory({ name: 'Education', icon: 'tag', color: '#000000' });
      expect(await MetadataService.removeCategory(created.id)).toBe('deleted');
      expect((await groups()).some((g) => g.id === created.id)).toBe(false);
    });

    it('restoring a sub-category under an archived category restores both', async () => {
      const transport = await category('Transport');
      const fuel = transport.items[0].id;
      await TransactionService.create({ title: 'Fuel', type: 'expense', subCategoryId: fuel, plannedAmount: 3000 });
      await MetadataService.removeCategory(transport.id);
      await MetadataService.restoreItem(fuel);
      const after = await category('Transport');
      expect(after.archived).toBe(false);
      expect(after.items.find((i) => i.id === fuel)?.archived).toBe(false);
    });
  });

  describe('review follow-ups', () => {
    it('stamps use when a rule is revised onto a new sub-category', async () => {
      const first = await itemId('Lifestyle', 'Dining Out');
      const second = await itemId('Lifestyle', 'Personal Care');
      const rule = await RuleService.create({
        name: 'Salon', type: 'expense', subCategoryId: first, amount: 800, repeats: 'monthly', dayOfMonth: 3, startDate: '2026-04-01',
      });
      await RuleService.revise(rule.ruleGroupId, { subCategoryId: second, effectiveFrom: '2026-10-01' });
      expect(await MetadataService.removeItem(second)).toBe('archived');
    });

    it('stamps use when a transaction is edited onto a new instrument', async () => {
      const credit = await mode('Credit Card');
      await MetadataService.addItem(credit.id, { label: 'Amex', last4: '1005' });
      const amex = await itemId('Credit Card', 'Amex');
      const tx = await TransactionService.create({
        title: 'Dinner', type: 'expense', subCategoryId: await itemId('Lifestyle', 'Dining Out'), plannedAmount: 1200,
      });
      await TransactionService.update(tx.id, { instrumentId: amex });
      expect(await MetadataService.removeItem(amex)).toBe('archived');
    });

    it('restoring a category makes its sub-categories pickable again', async () => {
      const transport = await category('Transport');
      await MetadataService.markUsed([transport.items[0].id]);
      await MetadataService.removeCategory(transport.id);
      await MetadataService.restoreCategory(transport.id);
      const picker = pickableLeaves(await groups(), 'category');
      expect(picker.find((p) => p.group.id === transport.id)?.items.length).toBe(transport.items.length);
    });

    it('rejects duplicate category names on create and rename, ignoring case', async () => {
      await expect(MetadataService.createCategory({ name: 'housing', icon: 'tag', color: '#000' })).rejects.toThrow(
        'A category with this name already exists',
      );
      const lifestyle = await category('Lifestyle');
      await expect(MetadataService.updateCategory(lifestyle.id, { name: 'ESSENTIALS' })).rejects.toThrow(
        'A category with this name already exists',
      );
    });

    it('renames an item: case-only rename of itself is fine, a sibling clash is not, last4 is validated and clearable', async () => {
      const groceryId = await itemId('Essentials', 'Grocery');
      await MetadataService.updateItem(groceryId, { label: 'grocery' });
      await expect(MetadataService.updateItem(groceryId, { label: 'Cooking Gas' })).rejects.toThrow(/already exists in Essentials/);

      const credit = await mode('Credit Card');
      await MetadataService.addItem(credit.id, { label: 'Regalia', last4: '4321' });
      const regalia = await itemId('Credit Card', 'Regalia');
      await expect(MetadataService.updateItem(regalia, { last4: '12' })).rejects.toThrow('Enter exactly the last 4 digits');
      await MetadataService.updateItem(regalia, { last4: '' });
      expect(resolveLeaf(await groups(), regalia)?.item.last4).toBeUndefined();
    });

    it('re-adding the name of an archived sibling says to restore it instead', async () => {
      const helpId = await itemId('Essentials', 'Domestic Help');
      await MetadataService.markUsed([helpId]);
      await MetadataService.removeItem(helpId);
      await expect(MetadataService.addItem((await category('Essentials')).id, { label: 'Domestic help' })).rejects.toThrow(
        /archived entry named “Domestic Help” exists — restore it instead/,
      );
    });
  });
});
