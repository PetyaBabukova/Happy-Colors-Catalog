import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import AnalyticsClientPage from '@/app/analytics/AnalyticsClientPage';
import {
  fetchAnalyticsSummary,
  fetchNewsletterSubscriberAnalytics,
} from '@/managers/analyticsManager';

vi.mock('@/managers/analyticsManager', () => ({
  fetchAnalyticsSummary: vi.fn(),
  fetchNewsletterSubscriberAnalytics: vi.fn(),
}));

const configuredSummary = {
  configured: true,
  cached: false,
  generatedAt: '2026-05-27T09:15:00.000Z',
  cacheTtlSeconds: 600,
  realtime: { activeUsers: 3 },
  periods: [
    {
      label: 'Today',
      activeUsers: 12,
      pageViews: 34,
      sessions: 15,
      averageEngagementSeconds: 75,
    },
  ],
  topPages: [
    {
      path: '/products',
      title: 'Catalog',
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
  devices: [
    {
      category: 'mobile',
      sessions: 12,
      activeUsers: 10,
      percent: 60,
    },
    {
      category: 'desktop',
      sessions: 8,
      activeUsers: 6,
      percent: 40,
    },
  ],
};

const subscriberAnalytics = {
  summary: {
    total: 3,
    active: 2,
    unsubscribed: 1,
    new: 1,
    resubscribed: 1,
  },
  pagination: {
    page: 1,
    pageSize: 50,
    totalPages: 1,
  },
  subscribers: [
    {
      id: 'sub-1',
      email: 'new@example.com',
      status: 'active',
      badge: 'new',
      firstSubscribedAt: '2026-06-02T09:00:00.000Z',
      lastSubscribedAt: '2026-06-02T09:00:00.000Z',
      unsubscribedAt: null,
      welcomeEmailSentAt: '2026-06-02T09:01:00.000Z',
    },
    {
      id: 'sub-2',
      email: 'old@example.com',
      status: 'unsubscribed',
      badge: 'unsubscribed',
      firstSubscribedAt: '2026-01-02T09:00:00.000Z',
      lastSubscribedAt: '2026-01-02T09:00:00.000Z',
      unsubscribedAt: '2026-02-02T09:00:00.000Z',
      welcomeEmailSentAt: '2026-01-02T09:01:00.000Z',
    },
  ],
};

describe('AnalyticsClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAnalyticsSummary.mockResolvedValue(configuredSummary);
    fetchNewsletterSubscriberAnalytics.mockResolvedValue(subscriberAnalytics);
  });

  it('blocks non-full-admin users on the client', () => {
    render(<AnalyticsClientPage />, {
      user: { username: 'Customer', role: 'customer' },
    });

    expect(screen.getByText(/full admin/i)).toBeInTheDocument();
    expect(fetchAnalyticsSummary).not.toHaveBeenCalled();
    expect(fetchNewsletterSubscriberAnalytics).not.toHaveBeenCalled();
  });

  it('renders the auth loading state before checking access', () => {
    render(<AnalyticsClientPage />, {
      authOverrides: { loading: true, user: undefined },
    });

    expect(screen.getByText((content) => content.endsWith('...'))).toBeInTheDocument();
    expect(fetchAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('renders analytics data for full admins', async () => {
    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.getByText('Organic Search')).toBeInTheDocument();
    expect(screen.getByText('Мобилно')).toBeInTheDocument();
    expect(screen.getByText('Компютър')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(screen.getByText('old@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Отписан').length).toBeGreaterThan(0);
    expect(fetchAnalyticsSummary).toHaveBeenCalledWith({ refresh: false });
    expect(fetchNewsletterSubscriberAnalytics).toHaveBeenCalled();
  });

  it('shows setup guidance when the API is not configured', async () => {
    fetchAnalyticsSummary.mockResolvedValueOnce({
      configured: false,
      generatedAt: '2026-05-27T09:15:00.000Z',
      cacheTtlSeconds: 600,
      periods: [],
      topPages: [],
      trafficSources: [],
      devices: [],
      realtime: { activeUsers: 0 },
    });

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByText(/Google Analytics API/i)).toBeInTheDocument();
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

  it('shows subscriber analytics errors separately', async () => {
    fetchNewsletterSubscriberAnalytics.mockRejectedValueOnce(new Error('Subscriber analytics failed'));

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByText('Subscriber analytics failed')).toBeInTheDocument();
    expect(await screen.findByText('Catalog')).toBeInTheDocument();
  });

  it('renders analytics data without waiting for subscriber analytics to finish', async () => {
    fetchNewsletterSubscriberAnalytics.mockReturnValueOnce(new Promise(() => {}));

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    expect(await screen.findByText('Catalog')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('disables refresh while the initial analytics request is loading', async () => {
    fetchAnalyticsSummary.mockReturnValueOnce(new Promise(() => {}));

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('requests a refresh from the button', async () => {
    fetchAnalyticsSummary
      .mockResolvedValueOnce(configuredSummary)
      .mockResolvedValueOnce({ ...configuredSummary, cached: false });

    render(<AnalyticsClientPage />, {
      user: { username: 'Petya', role: 'full_admin' },
    });

    fireEvent.click(await screen.findByRole('button'));

    await waitFor(() => {
      expect(fetchAnalyticsSummary).toHaveBeenLastCalledWith({ refresh: true });
    });
  });
});
