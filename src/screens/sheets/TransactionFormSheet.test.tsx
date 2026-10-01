// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SheetHost from '../../app/SheetHost';
import TransactionRow from '../Cashflow/TransactionRow';
import { MetadataService } from '../../services/MetadataService';
import { TransactionService } from '../../services/TransactionService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { setUpTestDatabase } from '../../test/dbTestUtils';
import { todayDateString } from '../../utils/date';

setUpTestDatabase();

function toggle(sheet: HTMLElement, label: 'Planned' | 'Completed'): HTMLElement {
  // ToggleGroup buttons sit inside a <label>, so find them by text.
  return within(sheet).getAllByRole('button').find((b) => b.textContent === label)!;
}

async function storedForToday() {
  const [y, m] = todayDateString().split('-').map(Number);
  return (await TransactionService.getForMonth(y, m)).filter((tx) => !tx.id.startsWith('virtual:'));
}

describe('TransactionFormSheet amounts', () => {
  beforeEach(async () => {
    await useMetadataStore.getState().load();
    const [y, m] = todayDateString().split('-').map(Number);
    await useTransactionStore.getState().loadMonth(y, m);
    useUiStore.setState({ activeSheet: { type: 'transaction', mode: 'create' } });
  });

  afterEach(() => cleanup());

  it('a new entry saved as Completed records planned 0 and actual = the entered amount', async () => {
    render(<SheetHost />);
    const sheet = await screen.findByRole('dialog', { name: 'Add planned transaction' });
    await userEvent.type(within(sheet).getByPlaceholderText('e.g. Broadband Internet'), 'Pharmacy');
    await userEvent.click(toggle(sheet, 'Completed'));
    await userEvent.type(within(sheet).getByPlaceholderText('Enter amount'), '300');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }));

    await waitFor(async () => expect(await storedForToday()).toHaveLength(1));
    const [tx] = await storedForToday();
    expect(tx).toMatchObject({ statusKind: 'actual', plannedAmount: 0, actualAmount: 300 });
  });

  it('keeps the typed amount when a new entry is switched from Completed back to Planned', async () => {
    render(<SheetHost />);
    const sheet = await screen.findByRole('dialog', { name: 'Add planned transaction' });
    await userEvent.click(toggle(sheet, 'Completed'));
    await userEvent.type(within(sheet).getByPlaceholderText('Enter amount'), '450');
    await userEvent.click(toggle(sheet, 'Planned'));
    expect(within(sheet).getByPlaceholderText('Enter amount')).toHaveValue(450);
  });

  it('completing a planned entry shows both amounts with actual pre-filled from planned', async () => {
    const housing = (await MetadataService.list()).find((g) => g.name === 'Housing')!;
    const created = await TransactionService.create({
      title: 'Rent', type: 'expense', subCategoryId: housing.items[0].id, plannedAmount: 24000, date: todayDateString(),
    });
    const [y, m] = todayDateString().split('-').map(Number);
    await useTransactionStore.getState().loadMonth(y, m);
    useUiStore.setState({ activeSheet: { type: 'transaction', mode: 'edit', targetId: created.id } });

    render(<SheetHost />);
    const sheet = await screen.findByRole('dialog', { name: 'Rent' });
    await userEvent.click(toggle(sheet, 'Completed'));
    expect(within(sheet).getByPlaceholderText('Enter planned amount')).toHaveValue(24000);
    expect(within(sheet).getByPlaceholderText('Enter actual amount')).toHaveValue(24000);
  });
});

describe('TransactionRow', () => {
  beforeEach(async () => {
    await useMetadataStore.getState().load();
  });

  afterEach(() => cleanup());

  it('shows the actual amount for an unplanned completion, and the derived payment mode with the instrument', async () => {
    const groups = await MetadataService.list();
    const housing = groups.find((g) => g.name === 'Housing')!;
    const cash = groups.find((g) => g.name === 'Cash')!;
    const tx = await TransactionService.create({
      title: 'Plumber', type: 'expense', subCategoryId: housing.items[0].id, statusKind: 'actual', actualAmount: 3000,
      instrumentId: cash.items[0].id, date: '2026-10-10',
    });
    await useMetadataStore.getState().refresh();
    render(<TransactionRow transaction={tx} />);
    expect(screen.getByText(/₹3,000/)).toBeInTheDocument();
    expect(screen.getByText('Cash · Cash')).toBeInTheDocument();
    expect(screen.getByText(/Housing › House Rent/)).toBeInTheDocument();
  });
});
