import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersAdminClientPage from '@/app/users/admin/UsersAdminClientPage';
import {
  approveAdminProduct,
  fetchAdminUserDossier,
  fetchAdminUsers,
} from '@/managers/usersAdminManager';
import { generateTranslation } from '@/managers/translationsManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/usersAdminManager', () => ({
  approveAdminProduct: vi.fn(),
  fetchAdminUserDossier: vi.fn(),
  fetchAdminReviewProduct: vi.fn(),
  fetchAdminUsers: vi.fn(),
  rejectAdminProduct: vi.fn(),
  updateAdminUser: vi.fn(),
}));

vi.mock('@/managers/translationsManager', () => ({
  acceptCurrentTranslation: vi.fn().mockResolvedValue({ status: 'current' }),
  generateTranslation: vi.fn().mockResolvedValue({ status: 'current' }),
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
    approveAdminProduct.mockResolvedValue({
      _id: 'product-1',
      title: 'Pending product',
      publicationStatus: 'published',
      reviewStatus: 'none',
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

  it('opens the English translation decision after approving a changed product', async () => {
    approveAdminProduct.mockResolvedValueOnce({
      _id: 'product-1',
      title: 'Pending product',
      publicationStatus: 'published',
      reviewStatus: 'none',
      englishTranslationDecision: {
        locale: 'en',
        status: 'needs_decision',
        sourceRevision: 2,
        translationRevision: 1,
        translationSourceRevision: 1,
      },
    });

    const { container } = render(<UsersAdminClientPage />, {
      user: { _id: 'admin-1', username: 'Admin', role: 'full_admin' },
    });

    await screen.findByText('Artist One');
    fireEvent.click(container.querySelector('button[class*="detailsButton"]'));
    await screen.findByText('Pending product');

    fireEvent.click(screen.getByRole('button', { name: /Одобри/ }));

    expect(await screen.findByRole('dialog', { name: 'The Bulgarian text has changed.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, update EN' }));

    await waitFor(() =>
      expect(generateTranslation).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'product-1',
        locale: 'en',
        expectedSourceRevision: 2,
        expectedTranslationRevision: 1,
      })
    );
  });
});
