import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesManagerPage from '@/app/categories/CategoriesClientPage';
import EditCategoryClient from '@/app/categories/[categoryId]/edit/EditCategoryClient';
import { useProducts } from '@/context/ProductContext';
import { acceptCurrentTranslation, generateTranslation } from '@/managers/translationsManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';
import { jsonResponse } from '../../api/_helpers.js';

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/managers/translationsManager', () => ({
  acceptCurrentTranslation: vi.fn(),
  generateTranslation: vi.fn(),
}));

describe('category admin pages', () => {
  const triggerCategoriesReload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    triggerCategoriesReload.mockClear();
    useProducts.mockReturnValue({ triggerCategoriesReload });
    setMockNavigation({ params: { categoryId: 'cat-1' } });
    acceptCurrentTranslation.mockClear();
    generateTranslation.mockClear();
    acceptCurrentTranslation.mockResolvedValue({ ok: true });
    generateTranslation.mockResolvedValue({ ok: true });
  });

  it('redirects guests away from category management without loading categories', async () => {
    const mockRouterPush = vi.fn();

    render(<CategoriesManagerPage />, { mockRouterPush });

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/users/login'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads categories and protects the miscellaneous category from deletion', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: [
          { _id: 'cat-1', name: 'Candles' },
          { _id: 'cat-2', name: 'Други' },
        ],
      })
    );

    const { container } = render(<CategoriesManagerPage />, { user: { username: 'admin' } });

    expect(await screen.findByText('Candles')).toBeInTheDocument();
    expect(screen.getByText('Други')).toBeInTheDocument();
    expect(container.querySelector('a[href="/categories/cat-1/edit"]')).toBeInTheDocument();
    expect(container.querySelectorAll('a[class*="deleteLink"]')).toHaveLength(1);
  });

  it('deletes a confirmed category and reloads the list', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Candles' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: { message: 'Deleted' } }))
      .mockResolvedValueOnce(jsonResponse({ body: [] }));

    const { container } = render(<CategoriesManagerPage />, { user: { username: 'admin' } });

    await screen.findByText('Candles');
    fireEvent.click(container.querySelector('a[class*="deleteLink"]'));

    await waitFor(() =>
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/categories/cat-1',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' })
      )
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Candles'));
    expect(alert).toHaveBeenCalledWith('Deleted');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    confirm.mockReturnValueOnce(false);
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Candles' }] }));

    const { container } = render(<CategoriesManagerPage />, { user: { username: 'admin' } });

    await screen.findByText('Candles');
    fireEvent.click(container.querySelector('a[class*="deleteLink"]'));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows category loading errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Nope' } }));

    const { container } = render(<CategoriesManagerPage />, { user: { username: 'admin' } });

    await waitFor(() => expect(container.textContent).toMatch(/Грешка|Р“СЂРµС€РєР°/));
  });

  it('loads a category for edit and submits the updated name', async () => {
    const mockRouterPush = vi.fn();
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'cat-1',
            name: 'Candles',
            slug: 'candles',
            canonicalSlug: 'candles',
            canonicalSlugReviewed: false,
            slugAliases: [],
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Decor' } }));

    const { container } = render(<EditCategoryClient />, { mockRouterPush });

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.change(container.querySelector('input[name="canonicalSlug"]'), { target: { value: 'decor' } });
    fireEvent.change(container.querySelector('input[name="slugAliases"]'), { target: { value: 'candles, old-candles' } });
    fireEvent.click(container.querySelector('input[name="canonicalSlugReviewed"]'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/categories/cat-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify({
            name: 'Decor',
            canonicalSlug: 'decor',
            canonicalSlugReviewed: true,
            slugAliases: ['candles', 'old-candles'],
          }),
        })
      )
    );
    expect(triggerCategoriesReload).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/categories');
  });

  it('opens an English translation decision after editing a translated category name', async () => {
    const mockRouterPush = vi.fn();
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'cat-1',
            name: 'Candles',
            slug: 'candles',
            canonicalSlug: 'candles',
            canonicalSlugReviewed: true,
            slugAliases: ['old-candles'],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'cat-1',
            name: 'Decor',
            sourceRevision: 3,
            englishTranslationDecision: {
              locale: 'en',
              status: 'needs_decision',
              sourceRevision: 3,
              translationRevision: 1,
              translationSourceRevision: 2,
            },
          },
        })
      );

    const { container } = render(<EditCategoryClient />, { mockRouterPush });

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yes, update EN/i }));

    await waitFor(() =>
      expect(generateTranslation).toHaveBeenCalledWith({
        entityType: 'category',
        entityId: 'cat-1',
        locale: 'en',
        expectedSourceRevision: 3,
        expectedTranslationRevision: 1,
      })
    );
    expect(triggerCategoriesReload).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/categories');
  });

  it('can accept the current English category translation after editing the source name', async () => {
    const mockRouterPush = vi.fn();
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'cat-1',
            name: 'Candles',
            slug: 'candles',
            canonicalSlug: 'candles',
            canonicalSlugReviewed: true,
            slugAliases: [],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'cat-1',
            name: 'Decor',
            sourceRevision: 4,
            englishTranslationDecision: {
              locale: 'en',
              status: 'needs_decision',
              sourceRevision: 4,
              translationRevision: 2,
              translationSourceRevision: 3,
            },
          },
        })
      );

    const { container } = render(<EditCategoryClient />, { mockRouterPush });

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No, keep current EN/i }));

    await waitFor(() =>
      expect(acceptCurrentTranslation).toHaveBeenCalledWith({
        entityType: 'category',
        entityId: 'cat-1',
        locale: 'en',
        expectedSourceRevision: 4,
        expectedTranslationRevision: 2,
      })
    );
    expect(triggerCategoriesReload).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/categories');
  });

  it('validates short edit names before calling the update endpoint', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles', slug: 'candles' } }));
    const { container } = render(<EditCategoryClient />);

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'A' } });
    fireEvent.submit(container.querySelector('form'));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });

  it('maps edit field errors from the backend', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles', slug: 'candles' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Name exists', field: 'name' } }));
    const { container } = render(<EditCategoryClient />);

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(container.textContent).toContain('Name exists'));
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });
});
