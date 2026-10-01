// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SheetHost from '../../app/SheetHost';
import { MetadataService } from '../../services/MetadataService';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { setUpTestDatabase } from '../../test/dbTestUtils';
import MasterDataScreen from './MasterDataScreen';

setUpTestDatabase();

function renderWithSheets() {
  return render(
    <>
      <MasterDataScreen />
      <SheetHost />
    </>,
  );
}

describe('MasterDataScreen', () => {
  beforeEach(async () => {
    useUiStore.setState({ activeSheet: null });
    await useMetadataStore.getState().load();
  });

  afterEach(() => cleanup());

  it('shows categories and payment modes, with no Status section', async () => {
    renderWithSheets();
    expect(await screen.findByText('Housing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /status/i })).not.toBeInTheDocument();
  });

  it('counts active categories only in the total-categories card', async () => {
    const created = await MetadataService.createCategory({ name: 'Education', icon: 'tag', color: '#000000' });
    const transport = (await MetadataService.list()).find((g) => g.name === 'Transport')!;
    await MetadataService.markUsed([transport.items[0].id]);
    await MetadataService.removeCategory(transport.id); // used -> archived
    await useMetadataStore.getState().refresh();
    renderWithSheets();
    // 6 seeded + Education − archived Transport
    await waitFor(() => expect(screen.getByTestId('total-categories')).toHaveTextContent('6'));
    expect(created.name).toBe('Education');
  });

  it('offers no way to add, rename or remove a payment mode — only instruments under it', async () => {
    renderWithSheets();
    await screen.findByText('Credit Card');
    expect(screen.queryByRole('button', { name: /^(rename|remove).*credit card/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add instrument to Credit Card')).toBeInTheDocument();
  });

  it('adds an instrument and shows it as "nickname ••last4"', async () => {
    renderWithSheets();
    await userEvent.click(await screen.findByLabelText('Add instrument to Credit Card'));
    await userEvent.type(screen.getByPlaceholderText('e.g. HDFC Regalia'), 'HDFC Regalia');
    await userEvent.type(screen.getByPlaceholderText('e.g. 4321'), '4321');
    await userEvent.click(screen.getByRole('button', { name: 'Add instrument' }));
    expect(await screen.findByText('HDFC Regalia ••4321')).toBeInTheDocument();
  });

  it('shows the validation message for a duplicate sub-category', async () => {
    renderWithSheets();
    await userEvent.click(await screen.findByText('Essentials'));
    const sheet = await screen.findByRole('dialog', { name: 'Essentials' });
    await userEvent.type(within(sheet).getByLabelText('New sub-category'), 'grocery');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }));
    expect(await within(sheet).findByText('A sub-category with this name already exists in Essentials')).toBeInTheDocument();
  });

  it('removing a never-used sub-category asks to delete permanently; a used one is archived', async () => {
    const essentials = (await MetadataService.list()).find((g) => g.name === 'Essentials')!;
    await MetadataService.markUsed([essentials.items.find((i) => i.label === 'Grocery')!.id]);
    await useMetadataStore.getState().refresh();
    renderWithSheets();
    await userEvent.click(await screen.findByText('Essentials'));
    const sheet = await screen.findByRole('dialog', { name: 'Essentials' });

    const cookingGas = within(sheet).getByText('Cooking Gas').closest('li')!;
    await userEvent.click(within(cookingGas).getByRole('button', { name: 'Remove' }));
    await userEvent.click(within(cookingGas).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(within(sheet).queryByText('Cooking Gas')).not.toBeInTheDocument());

    const grocery = within(sheet).getByText('Grocery').closest('li')!;
    await userEvent.click(within(grocery).getByRole('button', { name: 'Remove' }));
    expect(await within(sheet).findByText('“Grocery” is in use — archived, not deleted')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('a new sub-category is pickable on a transaction straight away, and Status has only two choices', async () => {
    renderWithSheets();
    await userEvent.click(await screen.findByText('Essentials'));
    const sheet = await screen.findByRole('dialog', { name: 'Essentials' });
    await userEvent.type(within(sheet).getByLabelText('New sub-category'), 'Water Purifier Service');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }));
    await within(sheet).findByText('Water Purifier Service');

    useTransactionStore.setState({ transactions: [] });
    useUiStore.setState({ activeSheet: { type: 'transaction', mode: 'create' } });
    const txSheet = await screen.findByRole('dialog', { name: 'Add planned transaction' });
    const picker = within(txSheet).getByLabelText('Sub-category');
    expect(within(picker).getByRole('option', { name: 'Water Purifier Service' })).toBeInTheDocument();
    expect(within(txSheet).queryByText(/status label/i)).not.toBeInTheDocument();
    // The Status toggle lives inside a <label>, so match its options by text.
    const toggleButtons = within(txSheet)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((text) => text === 'Planned' || text === 'Completed');
    expect(toggleButtons).toEqual(['Planned', 'Completed']);
  });
});
