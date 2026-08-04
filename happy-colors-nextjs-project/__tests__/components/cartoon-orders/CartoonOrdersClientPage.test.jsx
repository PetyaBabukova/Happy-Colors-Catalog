import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartoonOrdersClientPage from '@/app/cartoon-orders/CartoonOrdersClientPage';
import {
  completeCartoonOrder,
  fetchCartoonUploadCleanupStatus,
  fetchCartoonOrders,
  purgeOldCompletedCartoonOrders,
  rejectCartoonOrder,
  retryCartoonOrderNotifications,
  runCartoonUploadCleanup,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
  updateCartoonOrderWorkflow,
} from '@/managers/cartoonOrdersManager';
import { fireEvent, render, screen, waitFor, within } from '../test-utils.jsx';

vi.mock('@/managers/cartoonOrdersManager', () => ({
  completeCartoonOrder: vi.fn(),
  fetchCartoonUploadCleanupStatus: vi.fn(),
  fetchCartoonOrders: vi.fn(),
  purgeOldCompletedCartoonOrders: vi.fn(),
  rejectCartoonOrder: vi.fn(),
  retryCartoonOrderNotifications: vi.fn(),
  runCartoonUploadCleanup: vi.fn(),
  updateCartoonOrderAdminNotes: vi.fn(),
  updateCartoonOrderStatuses: vi.fn(),
  updateCartoonOrderWorkflow: vi.fn(),
}));

function buildOrder(overrides = {}) {
  const id = overrides._id || 'order-1';

  return {
    _id: id,
    workflowStatus: 'inquiry',
    customer: {
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      message: 'Warm family cartoon.',
      ...overrides.customer,
    },
    productSnapshot: {
      productId: 'product-1',
      title: 'Cartoon Portrait',
      price: 35,
      imageUrl: '',
    },
    photos: [
      {
        photoId: `photo-${id}`,
        displayName: 'photo.webp',
        originalName: 'photo.webp',
        contentType: 'image/webp',
        size: 1234,
        readUrl: `https://signed.example.com/${id}`,
        readUrlError: '',
        photoAccessStatus: 'available',
        deletedAt: null,
      },
    ],
    statuses: {
      ordered: false,
      designApproved: false,
      paid: false,
    },
    adminNotes: '',
    notifications: {
      admin: { status: 'sent', error: '', sentAt: '2026-06-05T10:01:00.000Z' },
      customer: { status: 'sent', error: '', sentAt: '2026-06-05T10:02:00.000Z' },
    },
    requiresAdminAttention: false,
    inquiryAt: '2026-06-05T10:00:00.000Z',
    waitingAt: null,
    orderedAt: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-06-05T10:00:00.000Z',
    updatedAt: '2026-06-05T10:00:00.000Z',
    ...overrides,
  };
}

function buildCleanupStatus(overrides = {}) {
  return {
    generatedAt: '2026-06-07T12:00:00.000Z',
    pendingUnclaimedUploadCount: 2,
    pendingUnclaimedUploadBytes: 3000,
    oldestUnclaimedUploadAgeHours: 25.5,
    uploadsOlderThan24Hours: 1,
    lastCleanupRun: {
      runType: 'unclaimed_upload_cleanup',
      startedAt: '2026-06-07T11:00:00.000Z',
      finishedAt: '2026-06-07T11:01:00.000Z',
      status: 'success',
      retentionHours: 24,
      candidateUploadCount: 2,
      deletedUploadCount: 2,
      failedUploadCount: 0,
      skippedLockedCount: 0,
      skippedOrderLinkedCount: 0,
      skippedUnsafeCount: 0,
      oldestDeletedAgeHours: 30,
      errorCategory: 'none',
    },
    lastRecordlessSweep: {
      runType: 'recordless_sweep',
      startedAt: '2026-06-07T10:00:00.000Z',
      finishedAt: '2026-06-07T10:01:00.000Z',
      status: 'success',
      retentionHours: 24,
      candidateUploadCount: 0,
      deletedUploadCount: 0,
      failedUploadCount: 0,
      skippedLockedCount: 0,
      skippedOrderLinkedCount: 0,
      skippedUnsafeCount: 0,
      oldestDeletedAgeHours: null,
      errorCategory: 'none',
    },
    lastReconciliation: {
      startedAt: '2026-06-07T09:00:00.000Z',
      finishedAt: '2026-06-07T09:01:00.000Z',
      status: 'success',
      repairedCounterCount: 1,
      repairedBytes: 1024,
    },
    recentLimitHits: {
      successfulInquiry: 3,
      uploadByte: 4,
    },
    warnings: ['uploads_older_than_24h'],
    ...overrides,
  };
}

const inquiryNewest = buildOrder({
  _id: 'inquiry-new',
  customer: { name: 'Newest Inquiry' },
  createdAt: '2026-06-06T10:00:00.000Z',
});
const waitingOlder = buildOrder({
  _id: 'waiting-old',
  workflowStatus: 'waiting',
  customer: { name: 'Waiting Inquiry' },
  createdAt: '2026-06-04T10:00:00.000Z',
  waitingAt: '2026-06-05T08:00:00.000Z',
});
const orderOld = buildOrder({
  _id: 'order-old',
  workflowStatus: 'ordered',
  customer: { name: 'Older Active Order' },
  statuses: { ordered: true, designApproved: false, paid: false },
  orderedAt: '2026-06-01T10:00:00.000Z',
});
const orderNew = buildOrder({
  _id: 'order-new',
  workflowStatus: 'ordered',
  customer: { name: 'Newer Active Order' },
  statuses: { ordered: true, designApproved: false, paid: false },
  orderedAt: '2026-06-03T10:00:00.000Z',
});
const completedOrder = buildOrder({
  _id: 'completed-1',
  workflowStatus: 'completed',
  customer: { name: 'Completed Customer' },
  statuses: { ordered: true, designApproved: true, paid: true },
  photos: [
    {
      photoId: 'photo-completed',
      displayName: 'completed.webp',
      readUrl: '',
      deletedAt: '2026-06-05T11:00:00.000Z',
      photoAccessStatus: 'deleted',
    },
  ],
  completedAt: '2026-06-05T11:00:00.000Z',
});
const initialOrders = [
  orderNew,
  waitingOlder,
  completedOrder,
  inquiryNewest,
  orderOld,
];

function renderAdmin() {
  return render(<CartoonOrdersClientPage />, {
    user: { _id: 'admin-1', role: 'full_admin' },
  });
}

describe('CartoonOrdersClientPage', () => {
  beforeEach(() => {
    fetchCartoonOrders.mockResolvedValue(initialOrders);
    fetchCartoonUploadCleanupStatus.mockResolvedValue(buildCleanupStatus());
    runCartoonUploadCleanup.mockResolvedValue({
      status: 'success',
      unclaimed: { deletedCount: 2 },
    });
    updateCartoonOrderWorkflow.mockImplementation((orderId, workflowStatus) => {
      const source = [inquiryNewest, waitingOlder, orderOld, orderNew].find(
        (order) => order._id === orderId
      );

      return Promise.resolve({
        ...source,
        workflowStatus,
        statuses: {
          ...source.statuses,
          ordered: workflowStatus === 'ordered',
        },
        orderedAt:
          workflowStatus === 'ordered' ? '2026-06-07T10:00:00.000Z' : source.orderedAt,
      });
    });
    updateCartoonOrderStatuses.mockImplementation((orderId, statuses) =>
      Promise.resolve({ ...orderOld, _id: orderId, statuses })
    );
    updateCartoonOrderAdminNotes.mockImplementation((orderId, adminNotes) => {
      const source = [inquiryNewest, waitingOlder, orderOld, orderNew].find(
        (order) => order._id === orderId
      );

      return Promise.resolve({ ...source, adminNotes });
    });
    rejectCartoonOrder.mockResolvedValue({ deleted: true });
    completeCartoonOrder.mockImplementation((orderId) =>
      Promise.resolve({
        ...orderOld,
        _id: orderId,
        workflowStatus: 'completed',
        completedAt: '2026-06-07T11:00:00.000Z',
        photos: orderOld.photos.map((photo) => ({
          ...photo,
          readUrl: '',
          deletedAt: '2026-06-07T11:00:00.000Z',
          photoAccessStatus: 'deleted',
        })),
      })
    );
    retryCartoonOrderNotifications.mockImplementation((orderId) =>
      Promise.resolve({
        ...inquiryNewest,
        _id: orderId,
        notifications: {
          admin: { status: 'sent', error: '', sentAt: '2026-06-07T11:01:00.000Z' },
          customer: { status: 'sent', error: '', sentAt: '2026-06-07T11:02:00.000Z' },
        },
      })
    );
    purgeOldCompletedCartoonOrders.mockResolvedValue({
      matchedCount: 2,
      deletedCount: 2,
      failedCount: 0,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('blocks non-full-admin users', () => {
    render(<CartoonOrdersClientPage />, {
      user: { _id: 'artist-1', role: 'artist' },
    });

    expect(screen.getByText(/full admin/)).toBeInTheDocument();
    expect(fetchCartoonOrders).not.toHaveBeenCalled();
    expect(fetchCartoonUploadCleanupStatus).not.toHaveBeenCalled();
  });

  it('renders all three workflow sections and completed orders by default', async () => {
    renderAdmin();

    expect(await screen.findByRole('heading', { name: 'Запитвания' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Поръчки' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Изпълнени поръчки' })).toBeInTheDocument();
    expect(await screen.findByText('Completed Customer')).toBeInTheDocument();
    expect(fetchCartoonOrders).toHaveBeenCalledWith();
  });

  it('sorts inquiries newest first and orders oldest first', async () => {
    renderAdmin();
    await screen.findByText('Newest Inquiry');

    const inquiryRows = document.querySelectorAll('[data-workflow-status="inquiry"], [data-workflow-status="waiting"]');
    const orderRows = document.querySelectorAll('[data-workflow-status="ordered"]');

    expect(within(inquiryRows[0]).getByText('Newest Inquiry')).toBeInTheDocument();
    expect(within(inquiryRows[1]).getByText('Waiting Inquiry')).toBeInTheDocument();
    expect(within(orderRows[0]).getByText('Older Active Order')).toBeInTheDocument();
    expect(within(orderRows[1]).getByText('Newer Active Order')).toBeInTheDocument();
  });

  it('applies distinct inquiry and waiting row states', async () => {
    renderAdmin();
    await screen.findByText('Newest Inquiry');

    expect(document.querySelector('[data-workflow-status="inquiry"]')).toBeInTheDocument();
    expect(document.querySelector('[data-workflow-status="waiting"]')).toBeInTheDocument();
    expect(screen.getAllByText('Изчакване').length).toBeGreaterThan(0);
  });

  it('promotes an inquiry to an order', async () => {
    renderAdmin();
    const inquiryName = await screen.findByText('Newest Inquiry');
    const row = inquiryName.closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: 'Поръчка' }));

    await waitFor(() =>
      expect(updateCartoonOrderWorkflow).toHaveBeenCalledWith('inquiry-new', 'ordered')
    );
    await waitFor(() =>
      expect(screen.getByText('Newest Inquiry').closest('tr')).toHaveAttribute(
        'data-workflow-status',
        'ordered'
      )
    );
  });

  it('marks an inquiry as waiting and can reactivate it', async () => {
    renderAdmin();
    const inquiryRow = (await screen.findByText('Newest Inquiry')).closest('tr');

    fireEvent.click(within(inquiryRow).getByRole('button', { name: 'Изчакване' }));

    await waitFor(() =>
      expect(updateCartoonOrderWorkflow).toHaveBeenCalledWith('inquiry-new', 'waiting')
    );

    const updatedRow = screen.getByText('Newest Inquiry').closest('tr');
    fireEvent.click(within(updatedRow).getByRole('button', { name: 'Активирай' }));

    await waitFor(() =>
      expect(updateCartoonOrderWorkflow).toHaveBeenLastCalledWith('inquiry-new', 'inquiry')
    );
  });

  it('rejects an inquiry after confirmation and removes the row', async () => {
    fetchCartoonOrders
      .mockResolvedValueOnce(initialOrders)
      .mockResolvedValueOnce([orderNew, waitingOlder, completedOrder, orderOld]);
    renderAdmin();
    const row = (await screen.findByText('Newest Inquiry')).closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: 'Откажи' }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(rejectCartoonOrder).toHaveBeenCalledWith('inquiry-new'));
    await waitFor(() => expect(fetchCartoonOrders).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Newest Inquiry')).not.toBeInTheDocument());
  });

  it('completes an order and moves it to the completed section', async () => {
    const completedOlderOrder = {
      ...orderOld,
      workflowStatus: 'completed',
      completedAt: '2026-06-07T11:00:00.000Z',
      photos: orderOld.photos.map((photo) => ({
        ...photo,
        readUrl: '',
        deletedAt: '2026-06-07T11:00:00.000Z',
        photoAccessStatus: 'deleted',
      })),
    };
    fetchCartoonOrders
      .mockResolvedValueOnce(initialOrders)
      .mockResolvedValueOnce([orderNew, waitingOlder, completedOrder, inquiryNewest, completedOlderOrder]);
    renderAdmin();
    const row = (await screen.findByText('Older Active Order')).closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: 'Изпълнена' }));

    await waitFor(() => expect(completeCartoonOrder).toHaveBeenCalledWith('order-old'));
    await waitFor(() => expect(fetchCartoonOrders).toHaveBeenCalledTimes(2));
    expect(window.confirm).toHaveBeenCalled();
    const completedRow = await waitFor(() => {
      const row = screen.getByText('Older Active Order').closest('tr');
      expect(row).toHaveAttribute('data-workflow-status', 'completed');
      return row;
    });
    expect(within(completedRow).queryByRole('link')).not.toBeInTheDocument();
  });

  it('preserves unrelated unsaved notes drafts after completing an order refreshes data', async () => {
    const completedOlderOrder = {
      ...orderOld,
      workflowStatus: 'completed',
      completedAt: '2026-06-07T11:00:00.000Z',
      photos: orderOld.photos.map((photo) => ({
        ...photo,
        readUrl: '',
        deletedAt: '2026-06-07T11:00:00.000Z',
        photoAccessStatus: 'deleted',
      })),
    };
    fetchCartoonOrders
      .mockResolvedValueOnce(initialOrders)
      .mockResolvedValueOnce([orderNew, waitingOlder, completedOrder, inquiryNewest, completedOlderOrder]);
    renderAdmin();
    const unrelatedNotes = await screen.findByLabelText(
      'Админ бележки за Newer Active Order, запис order-new'
    );
    fireEvent.change(unrelatedNotes, { target: { value: 'Keep this unsaved note.' } });
    const row = screen.getByText('Older Active Order').closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: 'Изпълнена' }));

    await waitFor(() => expect(fetchCartoonOrders).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(
      'Админ бележки за Newer Active Order, запис order-new'
    )).toHaveValue('Keep this unsaved note.');
  });

  it('saves notes in inquiry and order sections and updates order statuses', async () => {
    renderAdmin();
    await screen.findByText('Newest Inquiry');

    const inquiryNotes = screen.getByLabelText('Админ бележки за Newest Inquiry, запис inquiry-new');
    fireEvent.change(inquiryNotes, { target: { value: 'Call tomorrow.' } });
    fireEvent.click(
      within(inquiryNotes.closest('td')).getByRole('button', { name: 'Запази бележки' })
    );

    await waitFor(() =>
      expect(updateCartoonOrderAdminNotes).toHaveBeenCalledWith('inquiry-new', 'Call tomorrow.')
    );

    const orderNotes = screen.getByLabelText(
      'Админ бележки за Older Active Order, запис order-old'
    );
    fireEvent.change(orderNotes, { target: { value: 'Use warm colors.' } });
    fireEvent.click(
      within(orderNotes.closest('td')).getByRole('button', { name: 'Запази бележки' })
    );
    await waitFor(() =>
      expect(updateCartoonOrderAdminNotes).toHaveBeenCalledWith('order-old', 'Use warm colors.')
    );

    const orderRow = screen.getByText('Older Active Order').closest('tr');
    fireEvent.click(within(orderRow).getByLabelText('Платено'));
    await waitFor(() =>
      expect(updateCartoonOrderStatuses).toHaveBeenCalledWith(
        'order-old',
        expect.objectContaining({ paid: true })
      )
    );
  });

  it('purges old completed orders and refreshes the dashboard', async () => {
    renderAdmin();
    await screen.findByText('Completed Customer');
    fetchCartoonOrders.mockResolvedValueOnce([inquiryNewest]);

    fireEvent.click(screen.getByRole('button', { name: 'Изтрий стари' }));

    await waitFor(() => expect(purgeOldCompletedCartoonOrders).toHaveBeenCalled());
    await waitFor(() => expect(fetchCartoonOrders).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Изтрити стари изпълнени поръчки: 2.')).toBeInTheDocument();
    expect(screen.queryByText('Completed Customer')).not.toBeInTheDocument();
  });

  it('does not show purge success when the post-purge refresh fails', async () => {
    renderAdmin();
    await screen.findByText('Completed Customer');
    fetchCartoonOrders.mockRejectedValueOnce(new Error('Refresh failed'));

    fireEvent.click(screen.getByRole('button', { name: 'Изтрий стари' }));

    expect(await screen.findByText('Refresh failed')).toBeInTheDocument();
    expect(screen.queryByText(/Изтрити стари изпълнени поръчки:/)).not.toBeInTheDocument();
  });

  it('saves an unsaved notes draft before promoting an inquiry', async () => {
    renderAdmin();
    const notes = await screen.findByLabelText(
      'Админ бележки за Newest Inquiry, запис inquiry-new'
    );
    fireEvent.change(notes, { target: { value: 'Preserve this draft.' } });
    const row = screen.getByText('Newest Inquiry').closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: 'Поръчка' }));

    await waitFor(() =>
      expect(updateCartoonOrderAdminNotes).toHaveBeenCalledWith(
        'inquiry-new',
        'Preserve this draft.'
      )
    );
    expect(updateCartoonOrderAdminNotes.mock.invocationCallOrder[0]).toBeLessThan(
      updateCartoonOrderWorkflow.mock.invocationCallOrder[0]
    );
  });

  it('shows notification retry and row-level photo warnings', async () => {
    fetchCartoonOrders.mockResolvedValueOnce([
      buildOrder({
        _id: 'warning-order',
        customer: { name: 'Warning Customer' },
        requiresAdminAttention: true,
        photos: [
          {
            photoId: 'photo-warning',
            displayName: 'Снимка 1',
            readUrl: '',
            readUrlError: 'Photo links unavailable.',
            photoAccessStatus: 'unavailable',
            deletedAt: null,
          },
        ],
        notifications: {
          admin: { status: 'failed', error: 'delivery failed', sentAt: null },
          customer: { status: 'sent', error: '', sentAt: '2026-06-05T10:02:00.000Z' },
        },
      }),
    ]);
    renderAdmin();

    const row = (await screen.findByText('Warning Customer')).closest('tr');
    expect(within(row).getByText('Нужно внимание')).toBeInTheDocument();
    expect(within(row).getByText('Снимка 1')).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Изпрати пак' }));
    await waitFor(() =>
      expect(retryCartoonOrderNotifications).toHaveBeenCalledWith('warning-order')
    );
  });

  it('keeps notification recovery available for completed orders', async () => {
    fetchCartoonOrders.mockResolvedValueOnce([
      {
        ...completedOrder,
        notifications: {
          admin: { status: 'failed', error: 'delivery failed', sentAt: null },
          customer: { status: 'sent', error: '', sentAt: '2026-06-05T10:02:00.000Z' },
        },
      },
    ]);
    renderAdmin();

    const row = (await screen.findByText('Completed Customer')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: 'Изпрати пак' }));

    await waitFor(() =>
      expect(retryCartoonOrderNotifications).toHaveBeenCalledWith('completed-1')
    );
  });

  it('clears stale global errors after a successful refresh', async () => {
    fetchCartoonOrders
      .mockRejectedValueOnce(new Error('Backend down'))
      .mockResolvedValueOnce([inquiryNewest]);
    renderAdmin();

    expect(await screen.findByText('Backend down')).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-action="refresh"]'));

    expect(await screen.findByText('Newest Inquiry')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Backend down')).not.toBeInTheDocument());
  });

  it('refreshes persisted row state after a partial destructive failure', async () => {
    completeCartoonOrder.mockRejectedValueOnce(
      Object.assign(new Error('Снимките не са изтрити напълно.'), {
        data: { partial: true, retryable: true },
      })
    );
    fetchCartoonOrders
      .mockResolvedValueOnce([orderOld])
      .mockResolvedValueOnce([
        {
          ...orderOld,
          requiresAdminAttention: true,
          photos: orderOld.photos.map((photo) => ({
            ...photo,
            readUrl: '',
            readUrlError: 'Photo links unavailable.',
            photoAccessStatus: 'unavailable',
          })),
        },
      ]);
    renderAdmin();

    const row = (await screen.findByText('Older Active Order')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: 'Изпълнена' }));

    await waitFor(() => expect(fetchCartoonOrders).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Снимките не са изтрити напълно.')).toBeInTheDocument();
    expect(screen.getByText('Нужно внимание')).toBeInTheDocument();
  });

  it('renders aggregate upload cleanup health without private metadata', async () => {
    const { container } = renderAdmin();

    expect(await screen.findByText('Статистика на ъплоднатите снимки')).toBeInTheDocument();
    expect(screen.getByText('Ненужни снимки: последно чистене')).toBeInTheDocument();
    expect(screen.getByText('Снимки, качени във формата, но без изпратено запитване.')).toBeInTheDocument();
    expect(screen.getByText('Проверява дали upload броячите съвпадат с реалните снимки.')).toBeInTheDocument();
    expect(screen.getByText('Колко пъти защитите са ограничили запитвания или upload-и.')).toBeInTheDocument();
    expect(screen.getByText(/погрешно качени:/)).toBeInTheDocument();
    expect(screen.getByText(/без запис:/)).toBeInTheDocument();
    expect(screen.getByText('3 KB')).toBeInTheDocument();
    expect(screen.getByText('4 upload лимита')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/cartoon-orders\/reference-photos/);
    expect(container.textContent).not.toMatch(/cartoon-session-/);
  });

  it('runs manual upload cleanup and refreshes the health status', async () => {
    fetchCartoonUploadCleanupStatus
      .mockResolvedValueOnce(buildCleanupStatus())
      .mockResolvedValueOnce(buildCleanupStatus({
        pendingUnclaimedUploadCount: 0,
        pendingUnclaimedUploadBytes: 0,
        oldestUnclaimedUploadAgeHours: null,
        uploadsOlderThan24Hours: 0,
        warnings: [],
      }));
    renderAdmin();

    await screen.findByText('Статистика на ъплоднатите снимки');
    fireEvent.click(document.querySelector('[data-action="runUploadCleanup"]'));

    await waitFor(() => expect(runCartoonUploadCleanup).toHaveBeenCalledWith());
    await waitFor(() => expect(fetchCartoonUploadCleanupStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Почистването завърши:/)).toBeInTheDocument();
  });

  it('shows manual upload cleanup partial failures as an error', async () => {
    runCartoonUploadCleanup.mockResolvedValueOnce({
      status: 'partial_failure',
      unclaimed: { deletedCount: 1, failedCount: 1 },
      claimedOrphans: { deletedCount: 0, failedCount: 0 },
      recordlessSweep: { deletedCount: 0, failedCount: 0 },
    });
    renderAdmin();

    await screen.findByText('Статистика на ъплоднатите снимки');
    fireEvent.click(document.querySelector('[data-action="runUploadCleanup"]'));

    expect(await screen.findByText(/Почистването завърши с проблеми:/)).toBeInTheDocument();
  });

  it('does not render unexpected private metadata from order payloads', async () => {
    fetchCartoonOrders.mockResolvedValueOnce([
      {
        ...inquiryNewest,
        internalMetadata: {
          storageReference: 'hidden-storage-value',
          uploadClaimReference: 'hidden-claim-value',
        },
      },
    ]);
    renderAdmin();

    expect(await screen.findByText('Newest Inquiry')).toBeInTheDocument();
    expect(screen.queryByText(/hidden-storage-value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden-claim-value/)).not.toBeInTheDocument();
  });
});
