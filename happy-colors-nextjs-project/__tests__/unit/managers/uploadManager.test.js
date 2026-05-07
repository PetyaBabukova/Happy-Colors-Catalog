import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSignedUploadedFile,
  uploadImageToBucket,
  uploadImagesToBucket,
  uploadSignedFile,
} from '../../../src/managers/uploadManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

function buildFile({ name = 'candle.webp', size = 128, type = 'image/webp' } = {}) {
  return new File(['test-content'], name, { type, lastModified: 1, endings: 'transparent' });
}

describe('uploadManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('requires a selected image file before uploading to the legacy route', async () => {
    await expect(uploadImageToBucket()).rejects.toThrow('Не е избран файл.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads one image through the legacy upload route and returns imageUrl', async () => {
    const file = buildFile();
    fetch.mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/candle.webp' } }));

    await expect(uploadImageToBucket(file)).resolves.toBe('https://cdn.test/candle.webp');

    expect(fetch).toHaveBeenCalledWith(
      '/api/upload-image',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('returns uploaded image urls in input order', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/one.webp' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/two.webp' } }));

    await expect(uploadImagesToBucket([buildFile({ name: 'one.webp' }), buildFile({ name: 'two.webp' })])).resolves.toEqual([
      'https://cdn.test/one.webp',
      'https://cdn.test/two.webp',
    ]);
  });

  it('uses backend error messages from legacy image upload failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'File too large' } }));

    await expect(uploadImageToBucket(buildFile())).rejects.toThrow('File too large');
  });

  it('uses direct signed upload for image files when signing and storage upload succeed', async () => {
    const file = buildFile();
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            uploadUrl: 'https://storage.test/upload',
            formFields: { key: 'images/candle.webp', policy: 'policy' },
            publicUrl: 'https://cdn.test/images/candle.webp',
            objectName: 'images/candle.webp',
            deleteToken: 'delete-token',
          },
        })
      )
      .mockResolvedValueOnce({ ok: true });

    await expect(uploadSignedFile({ kind: 'image', file })).resolves.toEqual({
      publicUrl: 'https://cdn.test/images/candle.webp',
      objectName: 'images/candle.webp',
      deleteToken: 'delete-token',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/uploads/sign',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'image',
          fileName: 'candle.webp',
          fileSize: file.size,
          mimeType: 'image/webp',
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://storage.test/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('falls back to proxy upload when direct storage upload fails', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            uploadUrl: 'https://storage.test/upload',
            formFields: { key: 'images/candle.webp' },
            publicUrl: 'https://cdn.test/images/candle.webp',
            objectName: 'images/candle.webp',
            deleteToken: 'delete-token',
          },
        })
      )
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            publicUrl: 'https://cdn.test/proxy/candle.webp',
            objectName: 'proxy/candle.webp',
            deleteToken: 'proxy-token',
          },
        })
      );

    await expect(uploadSignedFile({ kind: 'image', file: buildFile() })).resolves.toEqual({
      publicUrl: 'https://cdn.test/proxy/candle.webp',
      objectName: 'proxy/candle.webp',
      deleteToken: 'proxy-token',
    });

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/uploads/proxy',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('routes video and poster uploads through the proxy route', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          publicUrl: 'https://cdn.test/videos/demo.mp4',
          objectName: 'videos/demo.mp4',
          deleteToken: 'video-token',
        },
      })
    );

    await expect(
      uploadSignedFile({ kind: 'video', file: buildFile({ name: 'demo.mp4', type: 'video/mp4' }) })
    ).resolves.toEqual({
      publicUrl: 'https://cdn.test/videos/demo.mp4',
      objectName: 'videos/demo.mp4',
      deleteToken: 'video-token',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/uploads/proxy', expect.objectContaining({ method: 'POST' }));
  });

  it('does not call delete route when objectName is empty', async () => {
    await expect(deleteSignedUploadedFile('', 'token')).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when delete route rejects cleanup', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'ignored' } }));

    await expect(deleteSignedUploadedFile('images/candle.webp', 'token')).rejects.toThrow(
      'Не успяхме да изчистим незаписания upload от storage.'
    );
  });
});
