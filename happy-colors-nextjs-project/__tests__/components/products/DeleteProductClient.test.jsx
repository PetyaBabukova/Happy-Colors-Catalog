import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteProductClient from '@/app/products/[productId]/delete/DeleteProductClient';
import { checkProductAccess } from '@/utils/checkProductAccess';
import { revalidatePublicProductSurfaces } from '@/managers/productsManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { jsonResponse } from '../../api/_helpers.js';

const triggerCategoriesReload = vi.fn();

vi.mock('@/utils/checkProductAccess', () => ({
  checkProductAccess: vi.fn(),
}));

vi.mock('@/context/ProductContext', () => ({
  useProducts: () => ({
    triggerCategoriesReload,
  }),
}));

vi.mock('@/managers/productsManager', () => ({
  canRequestPublicProductRevalidation: vi.fn(() => true),
  revalidatePublicProductSurfaces: vi.fn(),
}));

function renderDeleteProductClient(routerOverrides = {}, locale = 'en') {
  return render(
    <DeleteProductClient params={{ productId: 'product-1' }} />,
    {
      locale,
      user: { _id: 'admin-1', role: 'full_admin' },
      routerOverrides,
    }
  );
}

describe('DeleteProductClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    checkProductAccess.mockResolvedValue({
      product: { _id: 'product-1', title: 'Soy Candle', publicationStatus: 'published' },
      unauthorized: false,
      error: null,
    });
    revalidatePublicProductSurfaces.mockResolvedValue({ ok: true });
    fetch.mockResolvedValue(jsonResponse({ body: { success: true } }));
  });

  it('revalidates public product surfaces and refreshes the localized products page after delete', async () => {
    const push = vi.fn();
    const refresh = vi.fn();

    renderDeleteProductClient({ push, refresh }, 'en');

    await screen.findByText(/Soy Candle/);
    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(revalidatePublicProductSurfaces).toHaveBeenCalledWith('product-1'));
    expect(triggerCategoriesReload).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/products');
    expect(refresh).toHaveBeenCalled();
  });
});
