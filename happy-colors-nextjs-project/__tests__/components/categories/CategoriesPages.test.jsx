import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesManagerPage from '@/app/categories/CategoriesClientPage';
import EditCategoryClient from '@/app/categories/[categoryId]/edit/EditCategoryClient';
import { useProducts } from '@/context/ProductContext';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('category admin pages', () => {
  const triggerCategoriesReload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    triggerCategoriesReload.mockClear();
    useProducts.mockReturnValue({ triggerCategoriesReload });
    setMockNavigation({ params: { categoryId: 'cat-1' } });
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

    const { container } = render(<CategoriesManagerPage />);

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

    const { container } = render(<CategoriesManagerPage />);

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

    const { container } = render(<CategoriesManagerPage />);

    await screen.findByText('Candles');
    fireEvent.click(container.querySelector('a[class*="deleteLink"]'));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows category loading errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Nope' } }));

    const { container } = render(<CategoriesManagerPage />);

    await waitFor(() => expect(container.textContent).toMatch(/Грешка|Р“СЂРµС€РєР°/));
  });

  it('loads a category for edit and submits the updated name', async () => {
    const mockRouterPush = vi.fn();
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Decor' } }));

    const { container } = render(<EditCategoryClient />, { mockRouterPush });

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/categories/cat-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify({ name: 'Decor' }),
        })
      )
    );
    expect(triggerCategoriesReload).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/categories');
  });

  it('validates short edit names before calling the update endpoint', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles' } }));
    const { container } = render(<EditCategoryClient />);

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'A' } });
    fireEvent.submit(container.querySelector('form'));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });

  it('maps edit field errors from the backend', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Name exists', field: 'name' } }));
    const { container } = render(<EditCategoryClient />);

    await waitFor(() => expect(container.querySelector('input[name="name"]')).toHaveValue('Candles'));
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Decor' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(container.textContent).toContain('Name exists'));
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });
});
