import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeBannerForm from '@/components/home-banners/HomeBannerForm';
import { deleteSignedUploadedFile, uploadSignedFile } from '@/managers/uploadManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/uploadManager', () => ({
  deleteSignedUploadedFile: vi.fn(),
  uploadSignedFile: vi.fn(),
}));

function buildFile(name = 'banner.webp') {
  return new File(['image-content'], name, { type: 'image/webp' });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Заглавие'), { target: { value: 'Животинки' } });
  fireEvent.change(screen.getByLabelText('CTA текст'), { target: { value: 'Виж животинки' } });
  fireEvent.change(screen.getByLabelText('CTA линк'), { target: { value: '/search?q=животинки' } });
}

describe('HomeBannerForm', () => {
  beforeEach(() => {
    uploadSignedFile.mockImplementation(({ kind }) =>
      Promise.resolve(
        kind === 'home-banner-mobile-image'
          ? {
              publicUrl:
                'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner-mobile.webp',
              objectName: 'home-banners/mobile-images/banner-mobile.webp',
              deleteToken: 'mobile-delete-token',
            }
          : {
              publicUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
              objectName: 'home-banners/images/banner.webp',
              deleteToken: 'delete-token',
            }
      )
    );
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

  it('uploads a desktop image and submits normalized banner values', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Подредба'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Активен банер'));
    fireEvent.change(screen.getByLabelText('Desktop image'), {
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
          placement: 'home',
          ctaLabel: 'Виж животинки',
          ctaHref: '/search?q=животинки',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
          mobileImageUrl: '',
          sortOrder: 3,
          isActive: false,
        })
      );
    });
  });

  it('allows image-only cartoon banner submissions', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fireEvent.change(screen.getByLabelText('Позиция на банера'), { target: { value: 'cartoons' } });
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => {
      expect(uploadSignedFile).toHaveBeenCalledWith({ kind: 'home-banner-image', file: expect.any(File) });
    });

    expect(screen.queryByLabelText('Активен банер')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          placement: 'cartoons',
          title: '',
          ctaLabel: '',
          ctaHref: '',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
          isActive: true,
        })
      );
    });
  });

  it('rejects non-empty external CTA links for cartoon banners', async () => {
    const onSubmit = vi.fn();

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fireEvent.change(screen.getByLabelText('Позиция на банера'), { target: { value: 'cartoons' } });
    fireEvent.change(screen.getByLabelText('CTA линк'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/CTA линкът/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uploads a mobile image and submits it with the desktop image', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile('desktop.webp')] },
    });
    fireEvent.change(screen.getByLabelText('Mobile image (optional)'), {
      target: { files: [buildFile('mobile.webp')] },
    });

    await waitFor(() => {
      expect(uploadSignedFile).toHaveBeenCalledWith({ kind: 'home-banner-image', file: expect.any(File) });
      expect(uploadSignedFile).toHaveBeenCalledWith({
        kind: 'home-banner-mobile-image',
        file: expect.any(File),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
          mobileImageUrl:
            'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner-mobile.webp',
        })
      );
    });
  });

  it('keeps the form disabled until all in-flight uploads finish', async () => {
    let resolveDesktopUpload;
    let resolveMobileUpload;
    uploadSignedFile.mockImplementation(({ kind }) =>
      new Promise((resolve) => {
        if (kind === 'home-banner-mobile-image') {
          resolveMobileUpload = () =>
            resolve({
              publicUrl:
                'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner-mobile.webp',
              objectName: 'home-banners/mobile-images/banner-mobile.webp',
              deleteToken: 'mobile-delete-token',
            });
          return;
        }

        resolveDesktopUpload = () =>
          resolve({
            publicUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
            objectName: 'home-banners/images/banner.webp',
            deleteToken: 'delete-token',
          });
      })
    );

    render(<HomeBannerForm onSubmit={vi.fn()} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile('desktop.webp')] },
    });
    fireEvent.change(screen.getByLabelText('Mobile image (optional)'), {
      target: { files: [buildFile('mobile.webp')] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Запази' })).toBeDisabled();

    resolveDesktopUpload();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Homepage banner desktop preview' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Запази' })).toBeDisabled();

    resolveMobileUpload();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Запази' })).not.toBeDisabled();
    });
  });

  it('renders initial edit values and keeps the current mobile image when no new file is uploaded', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <HomeBannerForm
        initialValues={{
          title: 'Стар банер',
          description: 'Кратък текст',
          ctaLabel: 'Виж',
          ctaHref: '/products',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
          mobileImageUrl:
            'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/current-mobile.webp',
          sortOrder: 2,
          isActive: true,
        }}
        onSubmit={onSubmit}
        legendText="Редактиране"
      />
    );

    expect(screen.getByDisplayValue('Стар банер')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Homepage banner desktop preview' })).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp'
    );
    expect(screen.getByRole('img', { name: 'Homepage banner mobile preview' })).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/current-mobile.webp'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
          mobileImageUrl:
            'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/current-mobile.webp',
        })
      );
    });
    expect(uploadSignedFile).not.toHaveBeenCalled();
  });

  it('links to the banner translation manager when a translation href is provided', () => {
    render(
      <HomeBannerForm
        initialValues={{
          title: 'РЎС‚Р°СЂ Р±Р°РЅРµСЂ',
          ctaLabel: 'Р’РёР¶',
          ctaHref: '/products',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
        }}
        onSubmit={vi.fn()}
        legendText="Р РµРґР°РєС‚РёСЂР°РЅРµ"
        translationHref="/translations?entityType=homeBanner&entityId=banner-1"
      />
    );

    expect(screen.getByRole('link', { name: 'Управлявай EN превода' })).toHaveAttribute(
      'href',
      '/translations?entityType=homeBanner&entityId=banner-1'
    );
  });

  it('removes an existing mobile image and submits an explicit clear value', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <HomeBannerForm
        initialValues={{
          title: 'Стар банер',
          ctaLabel: 'Виж',
          ctaHref: '/products',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
          mobileImageUrl:
            'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/current-mobile.webp',
        }}
        onSubmit={onSubmit}
        legendText="Редактиране"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove mobile image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mobileImageUrl: '',
        })
      );
    });
    expect(deleteSignedUploadedFile).not.toHaveBeenCalled();
  });

  it('deletes an unsaved mobile upload immediately when it is removed', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fireEvent.change(screen.getByLabelText('Mobile image (optional)'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => {
      expect(uploadSignedFile).toHaveBeenCalledWith({
        kind: 'home-banner-mobile-image',
        file: expect.any(File),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove mobile image' }));

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith(
        'home-banners/mobile-images/banner-mobile.webp',
        'mobile-delete-token'
      );
    });
  });

  it('submits a clear value after replacing an existing mobile image and removing the replacement', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <HomeBannerForm
        initialValues={{
          title: 'Стар банер',
          ctaLabel: 'Виж',
          ctaHref: '/products',
          imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/current.webp',
          mobileImageUrl:
            'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/current-mobile.webp',
        }}
        onSubmit={onSubmit}
        legendText="Редактиране"
      />
    );

    fireEvent.change(screen.getByLabelText('Mobile image (optional)'), {
      target: { files: [buildFile()] },
    });
    await waitFor(() => {
      expect(uploadSignedFile).toHaveBeenCalledWith({
        kind: 'home-banner-mobile-image',
        file: expect.any(File),
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Homepage banner mobile preview' })).toHaveAttribute(
        'src',
        'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner-mobile.webp'
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove mobile image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mobileImageUrl: '',
        })
      );
    });
  });

  it('cleans up an uploaded image when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Backend rejected'));

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('home-banners/images/banner.webp', 'delete-token');
    });
    expect(await screen.findByText(/Backend rejected/)).toBeInTheDocument();
  });

  it('cleans up both uploaded images when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Backend rejected'));

    render(<HomeBannerForm onSubmit={onSubmit} legendText="Създаване на хоум банер" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile('desktop.webp')] },
    });
    fireEvent.change(screen.getByLabelText('Mobile image (optional)'), {
      target: { files: [buildFile('mobile.webp')] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith('home-banners/images/banner.webp', 'delete-token');
      expect(deleteSignedUploadedFile).toHaveBeenCalledWith(
        'home-banners/mobile-images/banner-mobile.webp',
        'mobile-delete-token'
      );
    });
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
    fireEvent.change(screen.getByLabelText('Desktop image'), {
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
    fireEvent.change(screen.getByLabelText('Desktop image'), {
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
    fireEvent.change(screen.getByLabelText('Desktop image'), {
      target: { files: [buildFile()] },
    });

    await waitFor(() => expect(uploadSignedFile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    expect(await screen.findByText(/600/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(deleteSignedUploadedFile).not.toHaveBeenCalled();
  });
});
