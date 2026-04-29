import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getVideoDurationSeconds } from '../../../src/utils/videoMetadata.js';

describe('videoMetadata', () => {
  let originalCreateElement;
  let video;

  function installVideoMock() {
    video = {
      duration: 0,
      preload: '',
      src: '',
      onloadedmetadata: null,
      onerror: null,
      load: vi.fn(),
      removeAttribute: vi.fn((name) => {
        delete video[name];
      }),
    };

    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'video') {
        return video;
      }

      return originalCreateElement(tagName);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:unit-video'),
      revokeObjectURL: vi.fn(),
    });
    installVideoMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects when no file is provided', async () => {
    await expect(getVideoDurationSeconds(null)).rejects.toThrow();
  });

  it('resolves duration from the loadedmetadata event and cleans up the element', async () => {
    const promise = getVideoDurationSeconds(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));

    video.duration = 12.5;
    video.onloadedmetadata();

    await expect(promise).resolves.toBe(12.5);
    expect(video.removeAttribute).toHaveBeenCalledWith('src');
    expect(video.load).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:unit-video');
  });

  it('rejects on video error and on timeout', async () => {
    const errorPromise = getVideoDurationSeconds(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    video.onerror();

    await expect(errorPromise).rejects.toThrow();

    installVideoMock();
    const timeoutPromise = getVideoDurationSeconds(new File(['video'], 'slow.mp4', { type: 'video/mp4' }));

    vi.advanceTimersByTime(10_000);

    await expect(timeoutPromise).rejects.toThrow();
  });

  it('settles only once when multiple events fire', async () => {
    const promise = getVideoDurationSeconds(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const errorHandler = video.onerror;

    video.duration = 8;
    video.onloadedmetadata();
    errorHandler();

    await expect(promise).resolves.toBe(8);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
