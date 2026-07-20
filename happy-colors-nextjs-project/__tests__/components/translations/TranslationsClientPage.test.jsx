import { beforeEach, describe, expect, it, vi } from 'vitest';
import TranslationsClientPage from '@/app/translations/TranslationsClientPage';
import {
  generateTranslation,
  getTranslationQueue,
  saveManualTranslation,
} from '@/managers/translationsManager';
import { fireEvent, render, screen, waitFor, within } from '../test-utils.jsx';

vi.mock('@/managers/translationsManager', () => ({
  acceptCurrentTranslation: vi.fn().mockResolvedValue({ status: 'current' }),
  approveTranslationDraft: vi.fn().mockResolvedValue({ status: 'current' }),
  generateTranslation: vi.fn().mockResolvedValue({ status: 'current' }),
  getTranslationQueue: vi.fn(),
  rejectTranslationDraft: vi.fn().mockResolvedValue({ status: 'missing' }),
  saveManualTranslation: vi.fn().mockResolvedValue({ status: 'current' }),
}));

describe('TranslationsClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranslationQueue.mockResolvedValue({
      unresolvedCount: 1,
      items: [
        {
          entityType: 'product',
          entityId: 'product-1',
          label: 'Плетено лъвче',
          locale: 'en',
          status: 'missing',
          activation: 'active',
          sourceRevision: 2,
          translationRevision: 0,
          draftRevision: 0,
        },
      ],
    });
  });

  it('renders unresolved translation queue items and can trigger generation', async () => {
    render(<TranslationsClientPage />);

    expect(await screen.findByText('Плетено лъвче')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Генерирай EN' }));

    await waitFor(() =>
      expect(generateTranslation).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'product-1',
        locale: 'en',
        expectedSourceRevision: 2,
        expectedTranslationRevision: 0,
      })
    );
  });

  it('saves manual product translations with revision guards', async () => {
    getTranslationQueue.mockResolvedValueOnce({
      unresolvedCount: 1,
      items: [
        {
          entityType: 'product',
          entityId: 'product-1',
          label: 'Плетено лъвче',
          locale: 'en',
          status: 'needs_decision',
          activation: 'active',
          sourceRevision: 2,
          translationRevision: 1,
          draftRevision: 0,
          translation: {
            title: 'Existing English title',
            description: 'Existing English description.',
          },
        },
      ],
    });
    render(<TranslationsClientPage />);

    const item = await screen.findByRole('article');
    fireEvent.click(within(item).getByRole('button', { name: 'Ръчен превод' }));
    expect(screen.getByLabelText('EN заглавие')).toHaveValue('Existing English title');
    expect(screen.getByLabelText('EN описание')).toHaveValue('Existing English description.');

    fireEvent.change(screen.getByLabelText('EN заглавие'), {
      target: { value: 'Crocheted Little Lion' },
    });
    fireEvent.change(screen.getByLabelText('EN описание'), {
      target: { value: 'Soft handmade toy.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Запази ръчен EN' }));

    await waitFor(() =>
      expect(saveManualTranslation).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'product-1',
        locale: 'en',
        expectedSourceRevision: 2,
        expectedTranslationRevision: 1,
        fields: {
          title: 'Crocheted Little Lion',
          description: 'Soft handmade toy.',
        },
      })
    );
  });
});
