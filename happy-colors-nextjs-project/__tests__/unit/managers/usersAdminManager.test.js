import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveAdminProduct,
  fetchAdminReviewProduct,
  fetchAdminUserDossier,
  fetchAdminUsers,
  rejectAdminProduct,
  updateAdminUser,
} from '../../../src/managers/usersAdminManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('usersAdminManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches admin users with credentials', async () => {
    const users = [{ _id: 'user-1', username: 'admin' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: users }));

    await expect(fetchAdminUsers()).resolves.toEqual(users);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/users/admin', {
      credentials: 'include',
    });
  });

  it('fetches a single admin user dossier', async () => {
    const dossier = { _id: 'user-1', orders: [] };
    fetch.mockResolvedValueOnce(jsonResponse({ body: dossier }));

    await expect(fetchAdminUserDossier('user-1')).resolves.toEqual(dossier);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/users/admin/user-1', {
      credentials: 'include',
    });
  });

  it('updates admin users with a JSON patch payload', async () => {
    const payload = { role: 'artist', artistStatus: 'active' };
    const updated = { _id: 'user-1', ...payload };
    fetch.mockResolvedValueOnce(jsonResponse({ body: updated }));

    await expect(updateAdminUser('user-1', payload)).resolves.toEqual(updated);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/admin/user-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    );
  });

  it('loads and reviews products through admin product endpoints', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'product-1' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { publicationStatus: 'published' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { publicationStatus: 'rejected' } }));

    await expect(fetchAdminReviewProduct('product-1')).resolves.toEqual({ _id: 'product-1' });
    await expect(approveAdminProduct('product-1')).resolves.toEqual({ publicationStatus: 'published' });
    await expect(rejectAdminProduct('product-1', 'Needs clearer photos.')).resolves.toEqual({
      publicationStatus: 'rejected',
    });

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:3000/api/products/mine/product-1', {
      credentials: 'include',
    });
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:3000/api/products/product-1/approve', {
      method: 'PATCH',
      credentials: 'include',
    });
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/products/product-1/reject',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reviewNote: 'Needs clearer photos.' }),
      }
    );
  });

  it('throws backend response errors with server messages', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        status: 403,
        body: { message: 'Forbidden.', code: 'forbidden' },
      })
    );

    await expect(fetchAdminUsers()).rejects.toMatchObject({
      message: 'Forbidden.',
      code: 'forbidden',
    });
  });

  it('throws fallback errors when the response body has no message', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, status: 500, body: {} }));

    await expect(approveAdminProduct('product-1')).rejects.toThrow(/одобряване/);
  });
});
