import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditProductClient from '@/app/products/[productId]/edit/EditProductClient';
import { checkProductAccess } from '@/utils/checkProductAccess';
import { onEditProductSubmit } from '@/managers/productsManager';
import { generateTranslation } from '@/managers/translationsManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/utils/checkProductAccess', () => ({
  checkProductAccess: vi.fn(),
}));

vi.mock('@/managers/productsManager', () => ({
  onEditProductSubmit: vi.fn(),
}));

vi.mock('@/managers/translationsManager', () => ({
  acceptCurrentTranslation: vi.fn(),
  generateTranslation: vi.fn(),
}));

vi.mock('@/components/products/ProductForm', () => ({
  default: ({ onSubmit, translationHref }) => (
    <>
      {translationHref ? <a href={translationHref}>Manage EN translation</a> : null}
      <button
        type="button"
        onClick={() => onSubmit({ title: 'Updated title' }, vi.fn(), vi.fn(), vi.fn())}
      >
        Submit edit
      </button>
    </>
  ),
}));

function renderEditProductClient(routerOverrides = {}, user = { _id: 'admin-1', role: 'full_admin' }) {
  return render(
    <EditProductClient params={{ productId: 'product-1' }} />,
    {
      user,
      routerOverrides,
    }
  );
}

describe('EditProductClient', () => {
  beforeEach(() => {
    checkProductAccess.mockResolvedValue({
      product: {
        _id: 'product-1',
        title: 'Original title',
        description: 'Original description',
        publicationStatus: 'published',
      },
      unauthorized: false,
      error: null,
    });
    onEditProductSubmit.mockImplementation(async (...args) => {
      const options = args[7];
      options.onTranslationDecision({
        locale: 'en',
        status: 'needs_decision',
        sourceRevision: 3,
        translationRevision: 1,
        translationSourceRevision: 2,
      });
      return { _id: 'product-1' };
    });
    generateTranslation.mockResolvedValue({ ok: true });
  });

  it('links full admins directly to this product translation', async () => {
    renderEditProductClient();

    expect(await screen.findByRole('link', { name: 'Manage EN translation' })).toHaveAttribute(
      'href',
      '/translations?entityType=product&entityId=product-1'
    );
  });

  it('does not show translation management to non-admin product owners', async () => {
    renderEditProductClient({}, { _id: 'owner-1', role: 'artist' });

    await screen.findByRole('button', { name: 'Submit edit' });
    expect(screen.queryByRole('link', { name: 'Manage EN translation' })).not.toBeInTheDocument();
  });

  it('shows the English translation decision after a full-admin direct edit', async () => {
    const mockRefresh = vi.fn();
    const mockPush = vi.fn();

    renderEditProductClient({ push: mockPush, refresh: mockRefresh });

    fireEvent.click(await screen.findByRole('button', { name: 'Submit edit' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('The Bulgarian text has changed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Yes, update EN/i }));

    await waitFor(() =>
      expect(generateTranslation).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'product-1',
        locale: 'en',
        expectedSourceRevision: 3,
        expectedTranslationRevision: 1,
      })
    );
    expect(mockPush).toHaveBeenCalledWith('/products/product-1');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
