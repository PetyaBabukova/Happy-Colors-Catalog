import { describe, expect, it } from 'vitest';
import {
  passwordsMatchValidator,
  sanitizeText,
  validateContactForm,
  validateContactLength,
  validateEmailFormat,
  validateEmptyFields,
  validateImageUrl,
  validatePrice,
} from '../../../src/utils/formValidations.js';

describe('formValidations', () => {
  it('finds empty required fields while treating phone as optional', () => {
    expect(validateEmptyFields({
      name: '  ',
      email: undefined,
      message: null,
      phone: '',
      category: 'candles',
      count: 0,
    })).toEqual(['name', 'email', 'message']);
  });

  it('validates password and email helper failures and success paths', () => {
    expect(passwordsMatchValidator({ password: 'secret', repeatPassword: 'other' })).toMatchObject({
      fields: ['password', 'repeatPassword'],
      message: expect.any(String),
    });
    expect(passwordsMatchValidator({ password: 'secret', repeatPassword: 'secret' })).toBeNull();

    expect(validateEmailFormat({ email: 'not-an-email' })).toEqual({
      fields: ['email'],
      message: expect.stringContaining('e-mail'),
    });
    expect(validateEmailFormat({ email: ' petya@example.com ' })).toBeNull();
  });

  it('sanitizes contact form values and flags forbidden HTML', () => {
    expect(sanitizeText(' <b>Hello</b> ')).toBe('Hello');
    expect(validateContactForm({
      name: ' Petya ',
      message: '<script>alert(1)</script>Hello',
    })).toEqual({
      sanitizedValues: {
        name: 'Petya',
        message: 'alert(1)Hello',
      },
      hasForbiddenChars: true,
    });
    expect(validateContactForm({ message: 'Plain text' })).toEqual({
      sanitizedValues: { message: 'Plain text' },
      hasForbiddenChars: false,
    });
  });

  it('returns contact validation errors for short, long, and invalid fields', () => {
    expect(validateContactLength({
      name: 'Pe',
      phone: '1'.repeat(21),
      message: 'x'.repeat(201),
      email: 'bad-email',
    })).toEqual(['name', 'phone', 'message', 'email']);

    expect(validateContactLength({
      name: 'Petya',
      phone: '',
      message: 'Hello',
      email: 'petya@example.com',
    })).toEqual([]);
  });

  it('validates positive prices only', () => {
    expect(validatePrice({ price: '0' })).toEqual({
      fields: ['price'],
      message: expect.stringContaining('0'),
    });
    expect(validatePrice({ price: '12.50' })).toBeNull();
    expect(validatePrice({ price: 'abc' })).toEqual({
      fields: ['price'],
      message: expect.stringContaining('0'),
    });
  });

  it('accepts http image URLs and rejects invalid or unsafe protocols', () => {
    expect(validateImageUrl({ imageUrl: 'https://cdn.test/image.webp' })).toBeNull();
    expect(validateImageUrl({ imageUrl: 'ftp://cdn.test/image.webp' })).toEqual({
      fields: ['imageUrl'],
      message: expect.stringContaining('URL'),
    });
    expect(validateImageUrl({ imageUrl: 'not-a-url' })).toEqual({
      fields: ['imageUrl'],
      message: expect.stringContaining('URL'),
    });
  });
});
