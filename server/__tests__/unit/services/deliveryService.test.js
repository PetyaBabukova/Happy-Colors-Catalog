import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEcontOfficesByCityName, getSpeedyOfficesByCityName } from '../../../services/deliveryService.js';

function jsonResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('deliveryService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.ECONT_USERNAME = 'econt-user';
    process.env.ECONT_PASSWORD = 'econt-pass';
    process.env.SPEEDY_USERNAME = 'speedy-user';
    process.env.SPEEDY_PASSWORD = 'speedy-pass';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ECONT_USERNAME;
    delete process.env.ECONT_PASSWORD;
    delete process.env.SPEEDY_USERNAME;
    delete process.env.SPEEDY_PASSWORD;
  });

  it('maps Econt offices for exact city matches and sanitizes labels', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            cities: [{ id: 68134, name: 'София', nameEn: 'Sofia' }],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            offices: [
              {
                id: 101,
                code: '1001',
                name: '<b>Офис Център</b>',
                address: {
                  city: { name: 'София' },
                  fullAddress: 'бул. България 1',
                },
              },
              { id: 102, code: '1002', name: '', address: {} },
            ],
          },
        })
      );

    await expect(getEcontOfficesByCityName(' Sofia ')).resolves.toEqual([
      {
        id: '101',
        code: '1001',
        name: 'Офис Център',
        city: 'София',
        address: 'бул. България 1',
        label: 'Еконт: Офис Център | София | бул. България 1',
      },
    ]);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://demo.econt.com/ee/services/Nomenclatures/NomenclaturesService.getCities.json',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('econt-user:econt-pass').toString('base64')}`,
        }),
      })
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      countryCode: 'BGR',
      cityID: 68134,
    });
  });

  it('rejects Econt lookups when credentials or city matches are missing', async () => {
    delete process.env.ECONT_USERNAME;

    await expect(getEcontOfficesByCityName('София')).rejects.toMatchObject({ statusCode: 500 });
    expect(fetch).not.toHaveBeenCalled();

    process.env.ECONT_USERNAME = 'econt-user';
    fetch.mockResolvedValueOnce(jsonResponse({ body: { cities: [{ id: 1, name: 'Пловдив' }] } }));

    await expect(getEcontOfficesByCityName('София')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects blank Econt city names before calling the carrier', async () => {
    await expect(getEcontOfficesByCityName('   ')).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses Econt carrier error payloads and fallback response messages', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: { error: { message: 'Econt validation failed' } },
      })
    );

    await expect(getEcontOfficesByCityName('Sofia')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Econt validation failed',
    });

    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        status: 502,
        body: { message: 'Gateway unavailable' },
      })
    );

    await expect(getEcontOfficesByCityName('Sofia')).rejects.toMatchObject({
      statusCode: 502,
      message: 'Gateway unavailable',
    });
  });

  it('maps Econt offices using contains city matches and address fallbacks', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            cities: [{ id: 68134, name: 'Sofia City', nameEn: 'Sofia City' }],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            offices: [
              {
                code: 'EC1',
                nameEn: 'Office West',
                address: {
                  city: { nameEn: 'Sofia' },
                  street: 'Main',
                  num: '12',
                  other: 'floor 1',
                },
              },
            ],
          },
        })
      );

    await expect(getEcontOfficesByCityName('Sofia')).resolves.toEqual([
      expect.objectContaining({
        id: 'EC1',
        code: 'EC1',
        name: 'Office West',
        city: 'Sofia',
        address: 'Main, 12, floor 1',
      }),
    ]);
  });

  it('deduplicates Speedy offices across matched sites', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            sites: [
              { id: 1, name: 'Варна', nameEn: 'Varna' },
              { id: 2, name: 'Варна', nameEn: 'Varna' },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            offices: [
              {
                id: 11,
                code: 'SP1',
                name: 'Офис Море',
                address: { siteAddress: { siteName: 'Варна' }, fullAddressString: 'ул. Морска 1' },
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            offices: [
              {
                id: 12,
                code: 'SP1',
                name: 'Офис Море',
                address: { siteAddress: { siteName: 'Варна' }, fullAddressString: 'ул. Морска 1' },
              },
            ],
          },
        })
      );

    await expect(getSpeedyOfficesByCityName('Варна')).resolves.toEqual([
      {
        id: '11',
        code: 'SP1',
        name: 'Офис Море',
        city: 'Варна',
        address: 'ул. Морска 1',
        label: 'Спиди: Офис Море | Варна | ул. Морска 1',
      },
    ]);

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      userName: 'speedy-user',
      password: 'speedy-pass',
      language: 'BG',
      countryId: 100,
      name: 'Варна',
    });
  });

  it('uses Speedy API error messages for failed carrier responses', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        status: 503,
        body: { error: { message: 'Speedy unavailable' } },
      })
    );

    await expect(getSpeedyOfficesByCityName('София')).rejects.toMatchObject({
      statusCode: 503,
      message: 'Speedy unavailable',
    });
  });

  it('rejects Speedy lookups when credentials or city names are missing', async () => {
    delete process.env.SPEEDY_PASSWORD;

    await expect(getSpeedyOfficesByCityName('Sofia')).rejects.toMatchObject({ statusCode: 500 });
    expect(fetch).not.toHaveBeenCalled();

    process.env.SPEEDY_PASSWORD = 'speedy-pass';

    await expect(getSpeedyOfficesByCityName('   ')).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects Speedy lookups when no matched site has a usable id', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: { sites: [{ name: 'Sofia', nameEn: 'Sofia', id: 'not-a-number' }] },
      })
    );

    await expect(getSpeedyOfficesByCityName('Sofia')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('uses Speedy fallback site matches and office address fallbacks', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            sites: [{ id: 10, name: 'Sofia Region', nameEn: 'Sofia Region' }],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            offices: [
              {
                id: 21,
                nameEn: 'Office East',
                address: {
                  siteAddress: { siteNameEn: 'Sofia' },
                  fullAddress: 'East boulevard 5',
                },
              },
              { id: 22, name: '', address: {} },
            ],
          },
        })
      );

    await expect(getSpeedyOfficesByCityName('Sofia')).resolves.toEqual([
      expect.objectContaining({
        id: '21',
        code: '',
        name: 'Office East',
        city: 'Sofia',
        address: 'East boulevard 5',
      }),
    ]);
  });

  it('uses Speedy carrier error payloads from successful HTTP responses', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: { error: { message: 'Invalid Speedy city' } },
      })
    );

    await expect(getSpeedyOfficesByCityName('Sofia')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid Speedy city',
    });
  });
});
