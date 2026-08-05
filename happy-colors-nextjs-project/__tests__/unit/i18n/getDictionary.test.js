import { describe, expect, it } from 'vitest';
import {
  collectDictionaryIssues,
  formatMessage,
  getDictionary,
  validateDictionaryParity,
} from '../../../src/i18n/getDictionary';

describe('i18n dictionaries', () => {
  it('keeps Bulgarian and English keys and placeholders in parity', () => {
    expect(validateDictionaryParity()).toBe(true);
    expect(collectDictionaryIssues()).toEqual([]);
  });

  it('reports placeholder mismatches without falling back to Bulgarian', () => {
    expect(
      collectDictionaryIssues({
        bg: { products: { price: 'Цена {price}' } },
        en: { products: { price: 'Price {amount}' } },
      })
    ).toEqual(['en.products.price placeholder mismatch.']);

    expect(() => formatMessage(getDictionary('en'), 'products.missing')).toThrow(
      /Missing dictionary key/
    );
  });

  it('formats named placeholders strictly', () => {
    const dictionary = getDictionary('en');

    expect(formatMessage(dictionary, 'products.priceInquiry', { price: '18' })).toBe(
      'Price 18 €. For availability and details, please send an inquiry.'
    );
    expect(() => formatMessage(dictionary, 'products.priceInquiry')).toThrow(
      /Missing placeholder values/
    );
    expect(() =>
      formatMessage(dictionary, 'products.priceInquiry', { price: '18', extra: 'value' })
    ).toThrow(/Unexpected placeholder values/);
  });

  it('rejects unsupported locale dictionary loading', () => {
    expect(() => getDictionary('fr')).toThrow(/Unsupported locale/);
  });
});
