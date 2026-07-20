import { assertSupportedLocale, LOCALE_DETAILS } from './config';

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function datePartsFromInput(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error('Invalid date value.');
    }

    return {
      year: input.getUTCFullYear(),
      month: input.getUTCMonth() + 1,
      day: input.getUTCDate(),
    };
  }

  if (typeof input === 'string') {
    const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateOnlyMatch) {
      return {
        year: Number(dateOnlyMatch[1]),
        month: Number(dateOnlyMatch[2]),
        day: Number(dateOnlyMatch[3]),
      };
    }

    const parsed = new Date(input);

    if (!Number.isNaN(parsed.getTime())) {
      return datePartsFromInput(parsed);
    }
  }

  throw new Error('Invalid date value.');
}

export function formatVisibleDate(input) {
  const { year, month, day } = datePartsFromInput(input);

  return `${padDatePart(day)}.${padDatePart(month)}.${year}`;
}

export function formatMachineDateIso(input) {
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return `${input}T00:00:00.000Z`;
    }

    const parsed = new Date(input);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString();
  }

  throw new Error('Invalid machine-readable date value.');
}

export function formatCount(count, locale, labels = {}) {
  const supportedLocale = assertSupportedLocale(locale);
  const numericCount = Number(count);

  if (!Number.isFinite(numericCount)) {
    throw new Error('Invalid count value.');
  }

  const formattedCount = new Intl.NumberFormat(
    LOCALE_DETAILS[supportedLocale].intlLocale
  ).format(numericCount);

  if (!labels.one || !labels.other) {
    return formattedCount;
  }

  return `${formattedCount} ${numericCount === 1 ? labels.one : labels.other}`;
}
