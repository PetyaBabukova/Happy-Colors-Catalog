import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeCartoonOrder,
  createCartoonOrder,
  createCartoonOrderUploadSession,
  cleanupCartoonOrderUploadedPhotos,
  fetchCartoonUploadCleanupStatus,
  fetchCartoonOrders,
  purgeOldCompletedCartoonOrders,
  rejectCartoonOrder,
  retryCartoonOrderNotifications,
  runCartoonUploadCleanup,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
  updateCartoonOrderWorkflow,
  uploadCartoonOrderPhoto,
} from '../../../src/managers/cartoonOrdersManager.js';

function jsonResponse({ ok = true, status = ok ? 200 : 400, body = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('cartoonOrdersManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates an upload session through the same-origin Next API route', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: {
        uploadSessionToken: 'session-token',
        maxFiles: 5,
      },
    }));

    await expect(createCartoonOrderUploadSession()).resolves.toEqual({
      uploadSessionToken: 'session-token',
      maxFiles: 5,
    });

    expect(fetch).toHaveBeenCalledWith('/api/cartoon-orders/upload-session', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  });

  it('uploads a cartoon order photo with the upload session token', async () => {
    const file = new File(['image-content'], 'face.webp', { type: 'image/webp' });
    fetch.mockResolvedValueOnce(jsonResponse({
      body: {
        objectName: 'cartoon-orders/reference-photos/face.webp',
        uploadConfirmationToken: 'confirmation-token',
      },
    }));

    await expect(uploadCartoonOrderPhoto({
      file,
      uploadSessionToken: 'session-token',
    })).resolves.toEqual({
      objectName: 'cartoon-orders/reference-photos/face.webp',
      uploadConfirmationToken: 'confirmation-token',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/cartoon-orders/uploads',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: expect.any(FormData),
      })
    );

    const formData = fetch.mock.calls[0][1].body;
    expect(formData.get('uploadSessionToken')).toBe('session-token');
    expect(formData.get('file')).toBe(file);
  });

  it('cleans up cartoon order uploaded photos with confirmation tokens', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { deletedCount: 2, failedCount: 0 },
    }));

    await expect(cleanupCartoonOrderUploadedPhotos({
      uploadSessionToken: 'session-token',
      uploadConfirmationTokens: ['confirmation-1', 'confirmation-2'],
    })).resolves.toEqual({ deletedCount: 2, failedCount: 0 });

    expect(fetch).toHaveBeenCalledWith(
      '/api/cartoon-orders/uploads/cleanup',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          uploadSessionToken: 'session-token',
          uploadConfirmationTokens: ['confirmation-1', 'confirmation-2'],
        }),
      })
    );
  });

  it('creates a cartoon order through the backend API', async () => {
    const payload = {
      name: 'Petya',
      email: 'petya@example.com',
      message: 'Cartoon idea',
      productId: 'product-1',
      photos: [],
      consentAccepted: true,
      website: '',
    };
    fetch.mockResolvedValueOnce(jsonResponse({ body: { orderId: 'order-1' } }));

    await expect(createCartoonOrder(payload)).resolves.toEqual({ orderId: 'order-1' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  });

  it('surfaces backend cartoon order errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      ok: false,
      status: 400,
      body: { message: 'Consent is required.' },
    }));

    await expect(createCartoonOrder({})).rejects.toMatchObject({
      message: 'Consent is required.',
      status: 400,
    });
  });

  it('fetches full-admin cartoon orders with archived filter support', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: [{ _id: 'order-1' }],
    }));

    await expect(fetchCartoonOrders({ includeArchived: true })).resolves.toEqual([
      { _id: 'order-1' },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders?includeArchived=true',
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('updates cartoon order statuses as a full-admin request', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { _id: 'order-1', statuses: { paid: true } },
    }));

    await expect(
      updateCartoonOrderStatuses('order-1', { paid: true })
    ).resolves.toEqual({ _id: 'order-1', statuses: { paid: true } });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/statuses',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ statuses: { paid: true } }),
      })
    );
  });

  it('updates cartoon order admin notes', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { _id: 'order-1', adminNotes: 'Warm colors' },
    }));

    await expect(
      updateCartoonOrderAdminNotes('order-1', 'Warm colors')
    ).resolves.toEqual({ _id: 'order-1', adminNotes: 'Warm colors' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/admin-notes',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ adminNotes: 'Warm colors' }),
      })
    );
  });

  it('updates cartoon order workflow', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { _id: 'order-1', workflowStatus: 'waiting' },
    }));

    await expect(
      updateCartoonOrderWorkflow('order-1', 'waiting')
    ).resolves.toEqual({ _id: 'order-1', workflowStatus: 'waiting' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/workflow',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ workflowStatus: 'waiting' }),
      })
    );
  });

  it('rejects a cartoon order', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { deleted: true } }));

    await expect(rejectCartoonOrder('order-1')).resolves.toEqual({ deleted: true });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/reject',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('purges old completed cartoon orders', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { matchedCount: 2, deletedCount: 2, failedCount: 0 },
    }));

    await expect(purgeOldCompletedCartoonOrders()).resolves.toEqual({
      matchedCount: 2,
      deletedCount: 2,
      failedCount: 0,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/purge-old-completed',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('fetches cartoon upload cleanup status as a full-admin request', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: {
        pendingUnclaimedUploadCount: 1,
        warnings: [],
      },
    }));

    await expect(fetchCartoonUploadCleanupStatus()).resolves.toEqual({
      pendingUnclaimedUploadCount: 1,
      warnings: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/upload-cleanup/status',
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('runs cartoon upload cleanup as a full-admin mutation', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: {
        status: 'success',
        unclaimed: { deletedCount: 2 },
      },
    }));

    await expect(runCartoonUploadCleanup()).resolves.toEqual({
      status: 'success',
      unclaimed: { deletedCount: 2 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/upload-cleanup/run',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ recordlessSweep: true }),
      }
    );
  });

  it('completes a cartoon order', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { _id: 'order-1', completedAt: '2026-06-05T10:00:00.000Z' },
    }));

    await expect(completeCartoonOrder('order-1')).resolves.toEqual({
      _id: 'order-1',
      completedAt: '2026-06-05T10:00:00.000Z',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/complete',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('retries failed cartoon order notifications', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      body: { _id: 'order-1', notificationStatus: 'sent' },
    }));

    await expect(retryCartoonOrderNotifications('order-1')).resolves.toEqual({
      _id: 'order-1',
      notificationStatus: 'sent',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cartoon-orders/order-1/notifications/retry',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('uses fallback errors for empty failed responses', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: null }));

    await expect(createCartoonOrderUploadSession()).rejects.toThrow();
  });
});
