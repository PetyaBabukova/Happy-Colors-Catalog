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
  default: ({ onSubmit }) => (
    <button
      type="button"
      onClick={() => onSubmit({ title: 'Updated title' }, vi.fn(), vi.fn(), vi.fn())}
    >
      Submit edit
    </button>
  ),
}));

function renderEditProductClient(routerOverrides = {}) {
  return render(
    <EditProductClient params={{ productId: 'product-1' }} />,
    {
      user: { _id: 'admin-1', role: 'full_admin' },
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
