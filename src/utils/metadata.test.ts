import { describe, expect, it } from 'vitest';
import type { MetadataGroup } from '../models/MetadataGroup';
import { describeInstrument, describeSubCategory, formatInstrument, leafOptions, pickableLeaves, resolveLeaf } from './metadata';

function group(partial: Partial<MetadataGroup> & Pick<MetadataGroup, 'id' | 'name' | 'items'>): MetadataGroup {
  return {
    key: 'category',
    icon: 'tag',
    color: '#000',
    isSystem: false,
    archived: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

const groups: MetadataGroup[] = [
  group({
    id: 'housing',
    name: 'Housing',
    order: 0,
    items: [
      { id: 'rent', label: 'House Rent', order: 0, archived: false },
      { id: 'tax', label: 'Property Tax', order: 1, archived: true },
    ],
  }),
  group({ id: 'empty', name: 'Empty', order: 1, items: [] }),
  group({ id: 'old', name: 'Old', order: 2, archived: true, items: [{ id: 'x', label: 'X', order: 0, archived: true }] }),
  group({
    id: 'credit',
    key: 'paymentMode',
    systemCode: 'creditCard',
    isSystem: true,
    name: 'Credit Card',
    items: [{ id: 'regalia', label: 'HDFC Regalia', last4: '4321', order: 0, archived: false }],
  }),
];

describe('metadata leaf helpers', () => {
  it('derives the parent from the leaf id alone — archived leaves included', () => {
    expect(resolveLeaf(groups, 'rent')?.group.name).toBe('Housing');
    expect(resolveLeaf(groups, 'tax')?.item.label).toBe('Property Tax');
    expect(resolveLeaf(groups, 'regalia')?.group.systemCode).toBe('creditCard');
    expect(resolveLeaf(groups, 'nope')).toBeUndefined();
  });

  it('offers only active leaves under active groups, and leaves out a category with nothing pickable', () => {
    const picker = pickableLeaves(groups, 'category');
    expect(picker.map((p) => p.group.name)).toEqual(['Housing']);
    expect(picker[0].items.map((i) => i.label)).toEqual(['House Rent']);
  });

  it('keeps an already-chosen archived value selectable when editing', () => {
    expect(pickableLeaves(groups, 'category', 'tax')[0].items.map((i) => i.id)).toEqual(['rent', 'tax']);
    expect(leafOptions(groups, 'category', 'x').map((g) => g.label)).toContain('Old');
  });

  it('formats instruments with their last 4 digits and sub-categories with their category', () => {
    expect(formatInstrument(groups[3].items[0])).toBe('HDFC Regalia ••4321');
    expect(formatInstrument({ id: 'g', label: 'GPay', order: 0, archived: false })).toBe('GPay');
    expect(describeSubCategory(groups, 'rent')).toBe('Housing › House Rent');
    expect(describeSubCategory(groups, 'missing')).toBe('Uncategorised');
    expect(leafOptions(groups, 'paymentMode')[0].options[0].label).toBe('HDFC Regalia ••4321');
  });

  it('shows the derived payment mode with the instrument, and never describes a payment leaf as a sub-category', () => {
    expect(describeInstrument(groups, 'regalia')).toBe('Credit Card · HDFC Regalia ••4321');
    expect(describeInstrument(groups, 'rent')).toBeUndefined();
    expect(describeSubCategory(groups, 'regalia')).toBe('Uncategorised');
  });
});
