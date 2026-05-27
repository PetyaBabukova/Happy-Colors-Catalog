import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductForm from '@/components/products/ProductForm';
import { useProducts } from '@/context/ProductContext';
import { deleteProductVideo } from '@/managers/productsManager';
import { deleteSignedUploadedFile, uploadImagesToBucket, uploadSignedFile } from '@/managers/uploadManager';
import { getVideoDurationSeconds } from '@/utils/videoMetadata';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/managers/uploadManager', () => ({
  deleteSignedUploadedFile: vi.fn(),
  uploadImagesToBucket: vi.fn(),
  uploadSignedFile: vi.fn(),
}));

vi.mock('@/managers/productsManager', () => ({
  deleteProductImage: vi.fn(),
  deleteProductVideo: vi.fn(),
}));

vi.mock('@/utils/videoMetadata', () => ({
  getVideoDurationSeconds: vi.fn(),
}));

function buildInitialValues(overrides = {}) {
  return {
    _id: 'product-1',
    title: 'Lavender Candle',
    description: 'A handmade candle.',
    category: { _id: 'cat-1', name: 'Candles' },
    price: '18',
    imageUrl: '/images/fallback.webp',
    imageUrls: ['/images/one.webp', '', '/images/two.webp'],
    availability: 'available',
    videos: [],
    ...overrides,
  };
}

function file(name, type, content = 'file-content') {
  return new File([content], name, { type });
}

describe('ProductForm', () => {
  beforeEach(() => {
    useProducts.mockReturnValue({
      categories: [
        { _id: 'cat-1', name: 'Candles' },
        { _id: 'cat-2', name: 'Decor' },
      ],
    });
    uploadImagesToBucket.mockResolvedValue(['/images/uploaded.webp']);
    uploadSignedFile.mockImplementation(({ kind }) =>
      Promise.resolve({
        publicUrl: kind === 'video' ? '/videos/uploaded.mp4' : '/images/uploaded-poster.webp',
        objectName: kind === 'video' ? 'products/videos/uploaded.mp4' : 'products/posters/uploaded.webp',
        deleteToken: `${kind}-delete-token`,
      })
    );
    deleteSignedUploadedFile.mockResolvedValue(undefined);
    deleteProductVideo.mockResolvedValue({ videos: [] });
    getVideoDurationSeconds.mockResolvedValue(12);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('normalizes initial values and submits the current form state', async () => {
    const onSubmit = vi.fn();

    const { container } = render(
      <ProductForm
        initialValues={buildInitialValues()}
        onSubmit={onSubmit}
        legendText="Edit product"
        successMessage="Saved"
      />
    );

    await waitFor(() => expect(container.querySelector('input[name="title"]')).toHaveValue('Lavender Candle'));

    expect(container.querySelector('select[name="category"]')).toHaveValue('cat-1');
    expect(container.querySelector('input[name="price"]')).toHaveValue(18);
    expect(screen.getByText(/Текущи изображения|РўРµРєСѓС‰Рё РёР·РѕР±СЂР°Р¶РµРЅРёСЏ/)).toBeInTheDocument();

    fireEvent.submit(container.querySelector('form'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lavender Candle',
        category: 'cat-1',
        imageUrls: ['/images/one.webp', '/images/two.webp'],
        imageUrl: '/images/one.webp',
        availability: 'available',
      }),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('ignores repeated submits while the first product save is still pending', async () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));

    const { container } = render(
      <ProductForm
        initialValues={buildInitialValues()}
        onSubmit={onSubmit}
        legendText="Create product"
      />
    );

    await waitFor(() => expect(container.querySelector('input[name="title"]')).toHaveValue('Lavender Candle'));

    const form = container.querySelector('form');
    const submitButton = container.querySelector('button[type="submit"]');

    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
  });

  it('submits edit forms without validating optional backend metadata fields', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ProductForm
        initialValues={buildInitialValues({
          category: { id: 'cat-1', name: 'Candles' },
          publicationStatus: 'published',
          reviewNote: '',
          reviewedAt: null,
          reviewedBy: null,
          deletedAt: null,
          deletedBy: null,
        })}
        onSubmit={onSubmit}
        legendText="Edit product"
      />
    );

    await waitFor(() => expect(container.querySelector('input[name="title"]')).toHaveValue('Lavender Candle'));
    expect(container.querySelector('select[name="category"]')).toHaveValue('cat-1');

    fireEvent.submit(container.querySelector('form'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'cat-1' }),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object)
    );
    expect(onSubmit.mock.calls[0][0]).not.toEqual(
      expect.objectContaining({
        reviewNote: '',
        reviewedAt: null,
        reviewedBy: null,
        deletedAt: null,
        deletedBy: null,
      })
    );
    expect(screen.queryByText(/Моля попълнете всички задължителни полета/)).not.toBeInTheDocument();
  });

  it('rejects non-image uploads before calling the upload manager', async () => {
    const { container } = render(<ProductForm initialValues={buildInitialValues()} onSubmit={vi.fn()} legendText="Edit" />);
    const imageInput = container.querySelector('input[name="imageUrls"]');

    fireEvent.change(imageInput, {
      target: { files: [file('notes.txt', 'text/plain')] },
    });

    expect(uploadImagesToBucket).not.toHaveBeenCalled();
    expect(await screen.findByText(/само файлове от тип изображение|СЃР°РјРѕ С„Р°Р№Р»РѕРІРµ/)).toBeInTheDocument();
  });

  it('uploads image files, merges unique image urls, and submits the uploaded image', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ProductForm
        initialValues={buildInitialValues({ imageUrls: ['/images/one.webp'] })}
        onSubmit={onSubmit}
        legendText="Edit"
      />
    );
    const imageInput = container.querySelector('input[name="imageUrls"]');

    fireEvent.change(imageInput, {
      target: { files: [file('uploaded.webp', 'image/webp')] },
    });

    await waitFor(() => expect(uploadImagesToBucket).toHaveBeenCalledWith([expect.any(File)]));
    await waitFor(() => expect(screen.getByText(/Текущи изображения: 2|РўРµРєСѓС‰Рё РёР·РѕР±СЂР°Р¶РµРЅРёСЏ: 2/)).toBeInTheDocument());

    fireEvent.submit(container.querySelector('form'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['/images/one.webp', '/images/uploaded.webp'],
        imageUrl: '/images/one.webp',
      }),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('auto-uploads a valid video and poster pair before submit', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ProductForm
        initialValues={buildInitialValues({ videos: [] })}
        onSubmit={onSubmit}
        legendText="Edit"
      />
    );

    fireEvent.change(container.querySelector('#product-video-file'), {
      target: { files: [file('demo.mp4', 'video/mp4')] },
    });
    fireEvent.change(container.querySelector('#product-video-poster'), {
      target: { files: [file('poster.webp', 'image/webp')] },
    });

    await waitFor(() => expect(getVideoDurationSeconds).toHaveBeenCalledWith(expect.any(File)));
    await waitFor(() =>
      expect(uploadSignedFile).toHaveBeenCalledWith({
        kind: 'video',
        file: expect.any(File),
      })
    );

    fireEvent.submit(container.querySelector('form'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        videos: [
          expect.objectContaining({
            url: '/videos/uploaded.mp4',
            posterUrl: '/images/uploaded-poster.webp',
            mimeType: 'video/mp4',
            durationSeconds: 12,
            videoObjectName: 'products/videos/uploaded.mp4',
            posterObjectName: 'products/posters/uploaded.webp',
          }),
        ],
      }),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('cleans up partially uploaded video assets when the second upload fails', async () => {
    uploadSignedFile
      .mockResolvedValueOnce({
        publicUrl: '/images/uploaded-poster.webp',
        objectName: 'products/posters/uploaded.webp',
        deleteToken: 'poster-token',
      })
      .mockRejectedValueOnce(new Error('video upload failed'));

    const { container } = render(<ProductForm initialValues={buildInitialValues()} onSubmit={vi.fn()} legendText="Edit" />);

    fireEvent.change(container.querySelector('#product-video-file'), {
      target: { files: [file('demo.mp4', 'video/mp4')] },
    });
    fireEvent.change(container.querySelector('#product-video-poster'), {
      target: { files: [file('poster.webp', 'image/webp')] },
    });

    await waitFor(() => expect(deleteSignedUploadedFile).toHaveBeenCalledWith('products/posters/uploaded.webp', 'poster-token'));
    expect(await screen.findByText('video upload failed')).toBeInTheDocument();
  });
});
