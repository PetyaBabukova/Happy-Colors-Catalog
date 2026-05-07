import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
