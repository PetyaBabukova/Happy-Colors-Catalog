import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlogArticleForm from '@/components/blog/BlogArticleForm';
import { deleteSignedUploadedFile, uploadBlogArticleImage } from '@/managers/uploadManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockRichTextEditor({ id, onChange, invalid }) {
      return (
        <textarea
          aria-label="Съдържание"
          id={id}
          data-invalid={invalid ? 'true' : 'false'}
          onChange={(event) =>
            onChange({
              contentHtml: event.target.value,
              contentJson: { type: 'doc', content: [] },
              contentText: event.target.value.replace(/<[^>]+>/g, '').trim(),
            })
          }
        />
      );
    },
}));

vi.mock('@/managers/uploadManager', () => ({
  deleteSignedUploadedFile: vi.fn(),
  uploadBlogArticleImage: vi.fn(),
}));

function buildFile() {
  return new File(['image-content'], 'article.webp', { type: 'image/webp' });
}

function buildTextFile() {
  return new File(['not-image'], 'article.txt', { type: 'text/plain' });
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^Заглавие/), { target: { value: 'Нова статия' } });
  fireEvent.change(screen.getByLabelText(/^Съдържание/), { target: { value: '<p>Текст</p>' } });
  fireEvent.change(screen.getByLabelText(/^Alt Текст за изображението/), { target: { value: 'Цветна снимка' } });
  fireEvent.change(screen.getByLabelText(/^Основно изображение/), { target: { files: [buildFile()] } });
  fireEvent.change(screen.getByLabelText(/^Миниатюрно изображение/), { target: { files: [buildFile()] } });
  await waitFor(() => expect(uploadBlogArticleImage).toHaveBeenCalledTimes(2));
}

describe('BlogArticleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadBlogArticleImage.mockImplementation(({ kind }) => {
      if (kind === 'thumbnail') {
        return Promise.resolve({
          kind: 'thumbnail',
          imageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
          objectName: 'blog/articles/thumbnails/article.webp',
          deleteToken: 'thumbnail-token',
        });
      }

      return Promise.resolve({
        kind: 'hero',
        imageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
        objectName: 'blog/articles/hero/article.webp',
        deleteToken: 'hero-token',
      });
    });
    deleteSignedUploadedFile.mockResolvedValue(undefined);
  });

  it('renders create form and validates required fields on the frontend', async () => {
    const onSubmit = vi.fn();

    render(<BlogArticleForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/Моля, проверете/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Съдържание/)).toHaveAttribute('id', 'content');
  });

  it('uploads hero and thumbnail images and submits only the allowed article payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<BlogArticleForm onSubmit={onSubmit} />);
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('Meta Title'), { target: { value: 'SEO' } });
    fireEvent.change(screen.getByLabelText('Meta Description'), { target: { value: 'SEO описание' } });
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];

    expect(payload).toEqual({
      title: 'Нова статия',
      contentHtml: '<p>Текст</p>',
      contentJson: { type: 'doc', content: [] },
      heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
      thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
      heroImageAlt: 'Цветна снимка',
      seoTitle: 'SEO',
      seoDescription: 'SEO описание',
    });
    expect(payload).not.toHaveProperty('owner');
    expect(payload).not.toHaveProperty('excerpt');
    expect(payload).not.toHaveProperty('publishedAt');
    expect(payload).not.toHaveProperty('archivedAt');
    expect(payload).not.toHaveProperty('newsletterReady');
  });

  it('renders edit initial values and archived warning', () => {
    render(
      <BlogArticleForm
        mode="edit"
        initialValues={{
          title: 'Стара статия',
          contentHtml: '<p>Стар текст</p>',
          contentText: 'Стар текст',
          heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/old.webp',
          thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/old.webp',
          heroImageAlt: 'Стара снимка',
          archivedAt: '2026-05-15T00:00:00.000Z',
        }}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Стара статия')).toBeInTheDocument();
    expect(screen.getByText(/архивирана/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Статус')).not.toBeInTheDocument();
  });

  it('enforces SEO and alt text length before submit', async () => {
    const onSubmit = vi.fn();

    render(<BlogArticleForm onSubmit={onSubmit} />);
    await fillValidForm();
    fireEvent.change(screen.getByLabelText(/^Alt Текст за изображението/), { target: { value: 'а'.repeat(181) } });
    fireEvent.change(screen.getByLabelText('Meta Title'), { target: { value: 'а'.repeat(71) } });
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/Моля, проверете/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects non-image files before calling the upload endpoint', async () => {
    const onSubmit = vi.fn();

    render(<BlogArticleForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^Основно изображение/), { target: { files: [buildTextFile()] } });

    expect(await screen.findByText(/изберете файл с изображение/)).toBeInTheDocument();
    expect(uploadBlogArticleImage).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cleans up uploaded hero and thumbnail when save fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Backend rejected'));

    render(<BlogArticleForm onSubmit={onSubmit} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('blog/articles/hero/article.webp', 'hero-token');
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('blog/articles/thumbnails/article.webp', 'thumbnail-token');
    });
    expect(await screen.findByText(/Backend rejected/)).toBeInTheDocument();
  });

  it('cleans up pending uploaded images when the form unmounts before save', async () => {
    const { unmount } = render(<BlogArticleForm onSubmit={vi.fn()} />);

    await fillValidForm();
    unmount();

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('blog/articles/hero/article.webp', 'hero-token');
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('blog/articles/thumbnails/article.webp', 'thumbnail-token');
    });
  });
});
