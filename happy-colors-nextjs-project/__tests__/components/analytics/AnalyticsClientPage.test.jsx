import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import AnalyticsClientPage from '@/app/analytics/AnalyticsClientPage';
import { fetchAnalyticsSummary } from '@/managers/analyticsManager';

vi.mock('@/managers/analyticsManager', () => ({
  fetchAnalyticsSummary: vi.fn(),
}));

const configuredSummary = {
  configured: true,
  cached: false,
  generatedAt: '2026-05-27T09:15:00.000Z',
  cacheTtlSeconds: 600,
  realtime: { activeUsers: 3 },
  periods: [
    {
      label: 'Днес',
      activeUsers: 12,
      pageViews: 34,
      sessions: 15,
      averageEngagementSeconds: 75,
    },
  ],
  topPages: [
    {
      path: '/products',
      title: 'Каталог',
      pageViews: 20,
      activeUsers: 8,
    },
  ],
  trafficSources: [
    {
      source: 'Organic Search',
      sessions: 9,
      activeUsers: 7,
    },
  ],
};

describe('AnalyticsClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAnalyticsSummary.mockResolvedValue(configuredSummary);
  });

  it('blocks non-full-admin users on the client', () => {
    render(<AnalyticsClientPage />, {
      user: { username: 'Customer', role: 'customer' },
    });

    expect(screen.getByText(/full admin/i)).toBeInTheDocument();
    expect(fetchAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('renders the auth loading state before checking access', () => {
    render(<AnalyticsClientPage />, {
      authOverrides: { loading: true, user: undefined },
    });

    expect(screen.getByText('Зареждане...')).toBeInTheDocument();
    expect(fetchAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('renders analytics data for full admins', async () => {
    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByRole('heading', { name: 'Анализи' })).toBeInTheDocument();
    expect(await screen.findByText('Каталог')).toBeInTheDocument();
    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.getByText('Organic Search')).toBeInTheDocument();
    expect(fetchAnalyticsSummary).toHaveBeenCalledWith({ refresh: false });
  });

  it('shows setup guidance when the API is not configured', async () => {
    fetchAnalyticsSummary.mockResolvedValueOnce({
      configured: false,
      generatedAt: '2026-05-27T09:15:00.000Z',
      cacheTtlSeconds: 600,
      periods: [],
      topPages: [],
      trafficSources: [],
      realtime: { activeUsers: 0 },
    });

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByText(/не е конфигуриран/i)).toBeInTheDocument();
  });

  it('shows an error when the analytics request fails', async () => {
    fetchAnalyticsSummary.mockRejectedValueOnce(
      new Error('Google Analytics OAuth authorization failed: Unauthorized')
    );

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(
      await screen.findByText('Google Analytics OAuth authorization failed: Unauthorized')
    ).toBeInTheDocument();
  });

  it('disables refresh while the initial analytics request is loading', async () => {
    fetchAnalyticsSummary.mockReturnValueOnce(new Promise(() => {}));

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Обнови' })).toBeDisabled();
    });
  });

  it('requests a refresh from the button', async () => {
    fetchAnalyticsSummary
      .mockResolvedValueOnce(configuredSummary)
      .mockResolvedValueOnce({ ...configuredSummary, cached: false });

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Обнови' }));

    await waitFor(() => {
      expect(fetchAnalyticsSummary).toHaveBeenLastCalledWith({ refresh: true });
    });
  });
});
