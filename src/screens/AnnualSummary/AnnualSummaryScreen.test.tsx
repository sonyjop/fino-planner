// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiscalYearSummary } from '../../models/FiscalYearSummary';
import { FiscalYearSummaryService } from '../../services/FiscalYearSummaryService';
import { useAnnualSummaryStore } from '../../stores/annualSummaryStore';
import { useMetadataStore } from '../../stores/metadataStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useUiStore } from '../../stores/uiStore';
import { fiscalYearMonths, fiscalYearStart } from '../../utils/date';
import AnnualSummaryScreen from './AnnualSummaryScreen';

function emptySummary(fyStartYear: number): FiscalYearSummary {
  return {
    fyStartYear,
    months: fiscalYearMonths(fyStartYear).map(({ monthKey }) => ({
      monthKey,
      income: { planned: 0, committed: 0 },
      expense: { planned: 0, committed: 0 },
    })),
    categories: { income: {}, expense: {} },
    updatedAt: '',
  };
}

describe('AnnualSummaryScreen', () => {
  beforeEach(() => {
    vi.spyOn(FiscalYearSummaryService, 'get').mockImplementation(async (fy) => emptySummary(fy));
    useMetadataStore.setState({ groups: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens on the FY containing today — January to March belong to the previous April', async () => {
    vi.useFakeTimers({ now: new Date(2027, 1, 15), toFake: ['Date'] });
    useAnnualSummaryStore.setState({ fyStartYear: fiscalYearStart(new Date()), summary: null });
    render(<AnnualSummaryScreen />);
    expect(screen.getByText('FY 2026–27')).toBeInTheDocument();
    expect(await screen.findByText('Apr 2026')).toBeInTheDocument();
    expect(screen.getByText('Mar 2027')).toBeInTheDocument();
    // Feb 2027 is today's month
    expect(screen.getByText('Feb 2027').closest('tr')).toHaveAttribute('aria-current', 'date');
  });

  it('moves one FY per chevron tap', async () => {
    useAnnualSummaryStore.setState({ fyStartYear: 2026, summary: null });
    render(<AnnualSummaryScreen />);
    await screen.findByText('Apr 2026');

    await userEvent.click(screen.getByLabelText('Next year'));
    expect(await screen.findByText('FY 2027–28')).toBeInTheDocument();
    expect(await screen.findByText('Apr 2027')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Previous year'));
    await userEvent.click(screen.getByLabelText('Previous year'));
    expect(await screen.findByText('FY 2025–26')).toBeInTheDocument();
  });

  it('keeps the selected FY across unmount/remount (tab switch)', async () => {
    useAnnualSummaryStore.setState({ fyStartYear: 2024, summary: null });
    const first = render(<AnnualSummaryScreen />);
    await screen.findByText('Apr 2024');
    first.unmount();

    render(<AnnualSummaryScreen />);
    expect(screen.getByText('FY 2024–25')).toBeInTheDocument();
    await waitFor(() => expect(FiscalYearSummaryService.get).toHaveBeenLastCalledWith(2024));
  });

  it('shows zeros and the empty-category message for a FY with no data', async () => {
    useAnnualSummaryStore.setState({ fyStartYear: 2026, summary: null });
    render(<AnnualSummaryScreen />);
    expect(await screen.findByText('Nothing planned for this year yet')).toBeInTheDocument();
    expect(screen.getByText('FY total')).toBeInTheDocument();
  });

  it('tapping a month opens that month on Cashflow', async () => {
    const loadMonth = vi.fn(async () => {});
    useTransactionStore.setState({ loadMonth });
    useAnnualSummaryStore.setState({ fyStartYear: 2026, summary: null });
    useUiStore.setState({ activeTab: 'annualSummary' });
    render(<AnnualSummaryScreen />);

    await userEvent.click(await screen.findByText('Aug 2026'));
    await act(async () => {});
    expect(loadMonth).toHaveBeenCalledWith(2026, 8);
    expect(useUiStore.getState().activeTab).toBe('cashflow');
  });

  it('shows a negative net with a minus sign in the expense colour', async () => {
    const summary = emptySummary(2026);
    summary.months[0].expense = { planned: 5000, committed: 0 };
    vi.mocked(FiscalYearSummaryService.get).mockResolvedValue(summary);
    useAnnualSummaryStore.setState({ fyStartYear: 2026, summary: null });
    render(<AnnualSummaryScreen />);

    const card = await screen.findByRole('table', { name: 'Yearly totals' });
    const netCell = card.querySelector('tbody tr:last-child td span');
    expect(netCell?.textContent).toMatch(/^-₹5,000$/);
    expect(netCell?.className).toMatch(/negative/);
  });
});
