export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_DAYS = 180;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
export const COOKIE_CONSENT_NAME = 'happy_colors_cookie_consent';

export const COOKIE_CONSENT_CHANGE_EVENT = 'happy-colors:cookie-consent-changed';
export const COOKIE_CONSENT_BROADCAST_CHANNEL = 'happy-colors-cookie-consent';
export const COOKIE_CONSENT_STORAGE_SYNC_KEY = 'happy_colors_cookie_consent_sync';

export const COOKIE_CATEGORIES = [
  {
    id: 'necessary',
    label: 'Необходими',
    required: true,
    description:
      'Тези технологии са нужни за коректната и сигурна работа на сайта. Те не могат да бъдат изключени от настройките.',
  },
  {
    id: 'analytics',
    label: 'Аналитични',
    required: false,
    description:
      'Помагат ни да разбираме как се използва сайтът, за да подобряваме съдържанието и потребителското изживяване.',
  },
  {
    id: 'marketing',
    label: 'Маркетингови',
    required: false,
    description:
      'Позволяват ни да измерваме и подобряваме рекламните си послания и кампании, когато използваме такива инструменти.',
  },
];

export const DEFAULT_COOKIE_CONSENT = {
  version: COOKIE_CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: '',
};

export const COOKIE_POLICY_SUMMARY =
  'Използваме бисквитки и подобни технологии, за да осигурим коректната работа на сайта и, когато ни дадете съгласие, да анализираме посещенията и да подобряваме съдържанието и рекламните си послания.';

export const COOKIE_POLICY_SECONDARY =
  'Можете да приемете всички, да продължите само с необходимите или да управлявате избора си от настройките. Повече информация има в Политиката за бисквитки.';

export function createConsentValue(overrides = {}, now = new Date()) {
  return {
    ...DEFAULT_COOKIE_CONSENT,
    ...overrides,
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: Boolean(overrides.analytics),
    marketing: Boolean(overrides.marketing),
    updatedAt: now.toISOString(),
  };
}

export function hasGlobalPrivacyControl() {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

export function isConsentExpired(consent, now = new Date()) {
  if (!consent?.updatedAt) {
    return true;
  }

  const updatedAt = new Date(consent.updatedAt);

  if (Number.isNaN(updatedAt.getTime())) {
    return true;
  }

  return now.getTime() - updatedAt.getTime() > COOKIE_CONSENT_MAX_AGE_SECONDS * 1000;
}

export function normalizeConsent(rawConsent, { gpc = false, now = new Date() } = {}) {
  if (!rawConsent || typeof rawConsent !== 'object') {
    return null;
  }

  if (rawConsent.version !== COOKIE_CONSENT_VERSION || isConsentExpired(rawConsent, now)) {
    return null;
  }

  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: gpc ? false : Boolean(rawConsent.analytics),
    marketing: gpc ? false : Boolean(rawConsent.marketing),
    updatedAt: String(rawConsent.updatedAt || ''),
  };
}

export function parseStoredConsent(value, options = {}) {
  if (!value) {
    return null;
  }

  try {
    return normalizeConsent(JSON.parse(value), options);
  } catch {
    return null;
  }
}

export function serializeConsentCookie(consent, { secure = true } = {}) {
  const encodedValue = encodeURIComponent(JSON.stringify(consent));
  const attributes = [
    `${COOKIE_CONSENT_NAME}=${encodedValue}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
  ];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function readConsentCookie(cookieString, options = {}) {
  const cookies = String(cookieString || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

  const cookie = cookies.find((item) => item.startsWith(`${COOKIE_CONSENT_NAME}=`));

  if (!cookie) {
    return null;
  }

  const rawValue = cookie.slice(COOKIE_CONSENT_NAME.length + 1);

  try {
    return parseStoredConsent(decodeURIComponent(rawValue), options);
  } catch {
    return null;
  }
}
