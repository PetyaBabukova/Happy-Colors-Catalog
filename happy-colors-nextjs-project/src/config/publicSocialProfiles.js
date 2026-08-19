export const PUBLIC_SOCIAL_PROFILES = Object.freeze([
  {
    service: 'facebook',
    href: 'https://www.facebook.com/happycolors.studio',
    labelKey: 'facebookLabel',
  },
  {
    service: 'instagram',
    href: 'https://www.instagram.com/happycolors.crochet/',
    labelKey: 'instagramLabel',
  },
  {
    service: 'etsy',
    href: 'https://happycolorsartshop.etsy.com/',
  },
  {
    service: 'youtube',
    href: 'https://www.youtube.com/@HappyColorsCrochet',
  },
  {
    service: 'tiktok',
    href: 'https://www.tiktok.com/@happycolorscrochet',
  },
]);

function isLocalHostname(hostname) {
  const normalizedHostname = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('127.') ||
    normalizedHostname.endsWith('.local') ||
    normalizedHostname.endsWith('.localhost')
  );
}

function isVerifiedPublicProfileUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    const hostname = parsedUrl.hostname.toLowerCase();

    return (
      parsedUrl.protocol === 'https:' &&
      !isLocalHostname(hostname) &&
      !hostname.includes('preview') &&
      !hostname.endsWith('.onrender.com') &&
      !hostname.endsWith('.vercel.app') &&
      !hostname.endsWith('.netlify.app')
    );
  } catch {
    return false;
  }
}

export function getVerifiedSocialProfiles(profiles = PUBLIC_SOCIAL_PROFILES) {
  const seen = new Set();

  return profiles
    .map((profile) => {
      if (!isVerifiedPublicProfileUrl(profile?.href)) {
        return null;
      }

      const href = new URL(profile.href).toString();

      if (seen.has(href)) {
        return null;
      }

      seen.add(href);

      return {
        ...profile,
        href,
      };
    })
    .filter(Boolean);
}

export function getVerifiedSameAsUrls(profiles = PUBLIC_SOCIAL_PROFILES) {
  return getVerifiedSocialProfiles(profiles).map(({ href }) => href);
}
