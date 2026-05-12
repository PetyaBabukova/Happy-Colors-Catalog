import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeBannerForm from '@/components/home-banners/HomeBannerForm';
import { deleteSignedUploadedFile, uploadSignedFile } from '@/managers/uploadManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/uploadManager', () => ({
  deleteSignedUploadedFile: vi.fn(),
  uploadSignedFile: vi.fn(),
}));

function buildFile() {
  return new File(['image-content'], 'banner.webp', { type: 'image/webp' });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Заглавие'), { target: { value: 'Животинки' } });
  fireEvent.change(screen.getByLabelText('CTA текст'), { target: { value: 'Виж животинки' } });
  fireEvent.change(screen.getByLabelText('CTA линк'), { target: { value: '/search?q=животинки' } });
}

describe('HomeBannerForm', () => {
  beforeEach(() => {
    uploadSignedFile.mockResolvedValue({
      publicUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
      objectName: 'home-banners/images/banner.webp',
      deleteToken: 'delete-token',
    });
    deleteSignedUploadedFile.mockResolvedValue(undefined);
  });

  it('renders an empty create form and validates required fields', async () => {
    const onSubmit = vi.fn();

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);

    expect(screen.getByText('Създаване на хоум банер')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/Моля, попълнете/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uploads an image and submits normalized banner values', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Подредба'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Активен банер'));
    fireEvent.change(screen.getByLabelText('Изображение'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => {
      expect(uploadSignedFile).toHaveBeenCalledWith({ kind: 'home-banner-image', file: expect.any(File) });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Животинки',
          ctaLabel: 'Виж животинки',
          ctaHref: '/search?q=животинки',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
          sortOrder: 3,
          isActive: false,
        })
      );
    });
  });

  it('renders initial edit values and keeps the current image when no new file is uploaded', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <HomeBannerForm
        initialValues={{
          title: 'Стар банер',
          description: 'Кратък текст',
          ctaLabel: 'Виж',
          ctaHref: '/products',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
          sortOrder: 2,
          isActive: true,
        }}
        onSubmit={onSubmit}
        legendText="Редактиране"
      />
    );

    expect(screen.getByDisplayValue('Стар банер')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Стар банер' })).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
        })
      );
    });
    expect(uploadSignedFile).not.toHaveBeenCalled();
  });

  it('cleans up an uploaded image when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Backend rejected'));

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Изображение'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('home-banners/images/banner.webp', 'delete-token');
    });
    expect(await screen.findByText(/Backend rejected/)).toBeInTheDocument();
  });

  it('prevents duplicate submits while save is still pending', async () => {
    let resolveSubmit;
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Изображение'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());

    const submitButton = screen.getByRole('button', { name: 'Запази' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submitButton).toBeDisabled());

    resolveSubmit({});
  });

  it('rejects external CTA links before submit', async () => {
    const onSubmit = vi.fn();

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('CTA линк'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByLabelText('Изображение'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/CTA линкът/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects overly long text fields before submit', async () => {
    const onSubmit = vi.fn();

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Кратък текст'), {
      target: { value: 'а'.repeat(601) },
    });
    fireEvent.change(screen.getByLabelText('Изображение'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/600/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(deleteSignedUploadedFile).not.toHaveBeenCalled();
  });
});
