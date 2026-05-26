import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersAdminClientPage from '@/app/users/admin/UsersAdminClientPage';
import {
  fetchAdminUserDossier,
  fetchAdminUsers,
} from '@/managers/usersAdminManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/usersAdminManager', () => ({
  approveAdminProduct: vi.fn(),
  fetchAdminUserDossier: vi.fn(),
  fetchAdminReviewProduct: vi.fn(),
  fetchAdminUsers: vi.fn(),
  rejectAdminProduct: vi.fn(),
  updateAdminUser: vi.fn(),
}));

describe('UsersAdminClientPage', () => {
  beforeEach(() => {
    fetchAdminUsers.mockResolvedValue([
      {
        _id: 'artist-1',
        username: 'Artist One',
        email: 'artist@example.com',
        role: 'artist',
        productCount: 1,
        pendingReviewCount: 1,
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ]);
    fetchAdminUserDossier.mockResolvedValue({
      user: {
        _id: 'artist-1',
        username: 'Artist One',
        email: 'artist@example.com',
        role: 'artist',
      },
      products: [
        {
          _id: 'product-1',
          title: 'Pending product',
          publicationStatus: 'published',
          reviewStatus: 'pending_review',
          availability: 'available',
          updatedAt: '2026-05-21T00:00:00.000Z',
          url: '/products/product-1',
        },
      ],
    });
  });

  it('marks users and products with pending review and opens the product page', async () => {
    const { container } = render(<UsersAdminClientPage />, {
      user: { _id: 'admin-1', username: 'Admin', role: 'full_admin' },
    });

    await screen.findByText('Artist One');
    expect(container.querySelector('tr[class*="pendingUserRow"]')).toBeInTheDocument();

    fireEvent.click(container.querySelector('button[class*="detailsButton"]'));

    await screen.findByText('Pending product');
    expect(container.querySelector('li[class*="pendingProductItem"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/products/product-1"]').className).toContain('pendingOpenLink');
    await waitFor(() => expect(fetchAdminUserDossier).toHaveBeenCalledWith('artist-1'));
  });
});
