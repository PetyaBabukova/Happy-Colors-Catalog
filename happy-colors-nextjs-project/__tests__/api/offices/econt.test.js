import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, readJson } from '../_helpers.js';

async function loadRoute() {
  return import('../../../src/app/api/offices/econt/route.js');
}

describe('/api/offices/econt', () => {
  beforeEach(() => {
    vi.doMock('@/config', () => ({ default: 'http://backend.test' }));
  });

  it('returns empty offices without calling the backend when city is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { GET } = await loadRoute();

    const response = await GET(createGetRequest('http://localhost/api/offices/econt'));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ offices: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies backend offices for a city', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ offices: [{ id: 'office-1' }] }),
      })
    );
    const { GET } = await loadRoute();

    const response = await GET(createGetRequest('http://localhost/api/offices/econt?city=Nova Zagora'));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ offices: [{ id: 'office-1' }] });
    expect(fetch).toHaveBeenCalledWith('http://backend.test/delivery/econt/offices?city=Nova%20Zagora', {
      method: 'GET',
      cache: 'no-store',
    });
  });

  it('returns backend errors with an empty offices array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({ message: 'Backend unavailable' }),
      })
    );
    const { GET } = await loadRoute();

    const response = await GET(createGetRequest('http://localhost/api/offices/econt?city=Sofia'));

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toEqual({
      message: 'Backend unavailable',
      offices: [],
    });
  });

  it('returns 500 when the backend fetch throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { GET } = await loadRoute();

    const response = await GET(createGetRequest('http://localhost/api/offices/econt?city=Sofia'));

    expect(response.status).toBe(500);
    await expect(readJson(response)).resolves.toMatchObject({ offices: [] });
  });
});
