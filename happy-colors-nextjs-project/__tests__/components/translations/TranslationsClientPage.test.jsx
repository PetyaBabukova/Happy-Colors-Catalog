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

  it('loads only the product selected from its edit page', async () => {
    getTranslationQueue.mockResolvedValueOnce({
      unresolvedCount: 0,
      items: [
        {
          entityType: 'product',
          entityId: 'product-1',
          label: 'Translated product',
          locale: 'en',
          status: 'current',
          activation: 'active',
          sourceRevision: 2,
          translationRevision: 1,
          draftRevision: 0,
        },
      ],
    });

    render(
      <TranslationsClientPage
        targetEntityType="product"
        targetEntityId="product-1"
      />
    );

    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.getByText('Актуален EN превод')).toBeInTheDocument();
    expect(
      screen.getByText('Управление на английския превод за избрания запис.')
    ).toBeInTheDocument();
    expect(getTranslationQueue).toHaveBeenCalledWith({
      locale: 'en',
      entityType: 'product',
      entityId: 'product-1',
    });
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
    fireEvent.click(within(item).getByRole('button', { name: 'Редактирай EN' }));
    expect(screen.getByLabelText('EN заглавие')).toHaveValue('Existing English title');
    expect(screen.getByLabelText('EN описание')).toHaveValue('Existing English description.');

    fireEvent.change(screen.getByLabelText('EN заглавие'), {
      target: { value: 'Crocheted Little Lion' },
    });
    fireEvent.change(screen.getByLabelText('EN описание'), {
      target: { value: 'Soft handmade toy.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Запази EN' }));

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

  it('edits a current blog translation as a new draft from targeted management', async () => {
    getTranslationQueue
      .mockResolvedValueOnce({
        unresolvedCount: 0,
        items: [
          {
            entityType: 'blogArticle',
            entityId: 'article-1',
            label: 'Блог статия',
            locale: 'en',
            status: 'current',
            activation: 'draft',
            sourceRevision: 4,
            translationRevision: 2,
            draftRevision: 0,
            translation: {
              title: 'Current English article',
              contentHtml: '<p>Current body.</p>',
              heroImageAlt: 'Current hero',
              seoTitle: 'Current SEO',
              seoDescription: 'Current SEO description',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        unresolvedCount: 1,
        items: [
          {
            entityType: 'blogArticle',
            entityId: 'article-1',
            label: 'Блог статия',
            locale: 'en',
            status: 'pending_review',
            activation: 'draft',
            sourceRevision: 4,
            translationRevision: 2,
            draftRevision: 1,
            translation: {
              title: 'Current English article',
              contentHtml: '<p>Current body.</p>',
              heroImageAlt: 'Current hero',
              seoTitle: 'Current SEO',
              seoDescription: 'Current SEO description',
            },
            draft: {
              title: 'Server normalized article',
              contentHtml: '<p>Server normalized body.</p>',
              heroImageAlt: 'Current hero',
              seoTitle: 'Current SEO',
              seoDescription: 'Current SEO description',
            },
          },
        ],
      });
    render(
      <TranslationsClientPage
        targetEntityType="blogArticle"
        targetEntityId="article-1"
      />
    );

    const item = await screen.findByRole('article');
    expect(within(item).queryByRole('button', { name: 'Приеми текущия EN' })).not.toBeInTheDocument();
    const titleInput = await screen.findByLabelText('EN заглавие');
    expect(titleInput).toHaveValue('Current English article');
    expect(screen.getByRole('button', { name: 'Запази промените' })).toBeInTheDocument();

    fireEvent.change(titleInput, {
      target: { value: 'Edited English article' },
    });
    fireEvent.change(screen.getByLabelText('EN HTML съдържание'), {
      target: { value: '<p>Edited <a href="/en/blog/bg-source">content</a></p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Запази промените' }));
    await waitFor(() =>
      expect(saveManualTranslation).toHaveBeenCalledWith({
        entityType: 'blogArticle',
        entityId: 'article-1',
        locale: 'en',
        expectedSourceRevision: 4,
        expectedDraftRevision: 0,
        fields: {
          title: 'Edited English article',
          contentHtml: '<p>Edited <a href="/en/blog/bg-source">content</a></p>',
          heroImageAlt: 'Current hero',
          seoTitle: 'Current SEO',
          seoDescription: 'Current SEO description',
        },
      })
    );
    expect(await screen.findByText('Корекциите са запазени като EN чернова за преглед.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запази промените' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Приеми текущия EN' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одобри чернова' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Редактирай EN' }));
    expect(screen.getByLabelText('EN заглавие')).toHaveValue('Server normalized article');
  });
});
