import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartoonOrdersClientPage from '@/app/cartoon-orders/CartoonOrdersClientPage';
import {
  completeCartoonOrder,
  fetchCartoonOrders,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
} from '@/managers/cartoonOrdersManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/cartoonOrdersManager', () => ({
  completeCartoonOrder: vi.fn(),
  fetchCartoonOrders: vi.fn(),
  updateCartoonOrderAdminNotes: vi.fn(),
  updateCartoonOrderStatuses: vi.fn(),
}));

const openOrder = {
  _id: 'order-1',
  customer: {
    name: 'Petya Babukova',
    email: 'petya@example.com',
    phone: '+359888123456',
    message: 'Warm family cartoon.',
  },
  productSnapshot: {
    productId: 'product-1',
    title: 'Cartoon Portrait',
    price: 35,
    imageUrl: '',
  },
  photos: [
    {
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      originalName: 'photo.webp',
      contentType: 'image/webp',
      size: 1234,
      readUrl: 'https://signed.example.com/photo.webp',
      deletedAt: null,
    },
  ],
  statuses: {
    ordered: true,
    designApproved: false,
    paid: false,
  },
  adminNotes: '',
  notificationStatus: 'sent',
  claimStatus: 'claimed',
  requiresAdminAttention: false,
  completedAt: null,
  archivedAt: null,
  createdAt: '2026-06-05T10:00:00.000Z',
  updatedAt: '2026-06-05T10:00:00.000Z',
};

describe('CartoonOrdersClientPage', () => {
  beforeEach(() => {
    fetchCartoonOrders.mockResolvedValue([openOrder]);
    updateCartoonOrderStatuses.mockImplementation((_orderId, statuses) =>
      Promise.resolve({ ...openOrder, statuses })
    );
    updateCartoonOrderAdminNotes.mockImplementation((_orderId, adminNotes) =>
      Promise.resolve({ ...openOrder, adminNotes })
    );
    completeCartoonOrder.mockResolvedValue({
      ...openOrder,
      completedAt: '2026-06-05T11:00:00.000Z',
      archivedAt: '2026-06-05T11:00:00.000Z',
      photos: [{ ...openOrder.photos[0], readUrl: '', deletedAt: '2026-06-05T11:00:00.000Z' }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('blocks non-full-admin users in the client page', () => {
    render(<CartoonOrdersClientPage />, {
      user: { _id: 'artist-1', role: 'artist', artistStatus: 'active' },
    });

    expect(screen.getByText(/full admin/)).toBeInTheDocument();
    expect(fetchCartoonOrders).not.toHaveBeenCalled();
  });

  it('renders orders and fetches archived orders when requested', async () => {
    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    expect(await screen.findByRole('heading', { name: 'Petya Babukova' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /photo.webp/ })).toHaveAttribute(
      'href',
      'https://signed.example.com/photo.webp'
    );

    fireEvent.click(screen.getByLabelText('Покажи архивирани'));

    await waitFor(() =>
      expect(fetchCartoonOrders).toHaveBeenLastCalledWith({ includeArchived: true })
    );
  });

  it('updates statuses and admin notes', async () => {
    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    await screen.findByRole('heading', { name: 'Petya Babukova' });

    fireEvent.click(screen.getByLabelText('Платено'));
    await waitFor(() =>
      expect(updateCartoonOrderStatuses).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ paid: true })
      )
    );

    fireEvent.change(screen.getByLabelText('Админ бележки'), {
      target: { value: 'Use warm colors.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запази/ }));

    await waitFor(() =>
      expect(updateCartoonOrderAdminNotes).toHaveBeenCalledWith('order-1', 'Use warm colors.')
    );
  });

  it('confirms completion and hides photo links after completion', async () => {
    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    await screen.findByRole('heading', { name: 'Petya Babukova' });
    fireEvent.click(screen.getByRole('button', { name: 'Завършена' }));

    await waitFor(() => expect(completeCartoonOrder).toHaveBeenCalledWith('order-1'));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Снимките са изтрити.')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /photo.webp/ })).not.toBeInTheDocument();
  });

  it('shows load errors instead of crashing', async () => {
    fetchCartoonOrders.mockRejectedValueOnce(new Error('Backend down'));

    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    expect(await screen.findByText('Backend down')).toBeInTheDocument();
  });

  it('renders defensive fallbacks for incomplete order payloads', async () => {
    fetchCartoonOrders.mockResolvedValueOnce([
      {
        _id: 'order-incomplete',
        statuses: {},
        completedAt: null,
        archivedAt: null,
        createdAt: null,
      },
    ]);

    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    expect(await screen.findByRole('heading', { name: 'Клиент без име' })).toBeInTheDocument();
    expect(screen.getByText(/Продукт без заглавие/)).toBeInTheDocument();
    expect(screen.getByText('Няма описание.')).toBeInTheDocument();
    expect(screen.getByText('Снимките са изтрити.')).toBeInTheDocument();
  });

  it('disables status and completion controls for completed orders', async () => {
    fetchCartoonOrders.mockResolvedValueOnce([
      {
        ...openOrder,
        completedAt: '2026-06-05T11:00:00.000Z',
        archivedAt: '2026-06-05T11:00:00.000Z',
        photos: [
          {
            ...openOrder.photos[0],
            readUrl: '',
            deletedAt: '2026-06-05T11:00:00.000Z',
          },
        ],
      },
    ]);

    render(<CartoonOrdersClientPage />, {
      user: { _id: 'admin-1', role: 'full_admin' },
    });

    expect(await screen.findByText('Снимките са изтрити.')).toBeInTheDocument();
    expect(screen.getByLabelText('Платено')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Завършена' })).toBeDisabled();
  });
});
