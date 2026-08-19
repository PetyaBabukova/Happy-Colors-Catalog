import { describe, expect, it } from 'vitest';
import {
  getVerifiedSameAsUrls,
  getVerifiedSocialProfiles,
} from '../../../src/config/publicSocialProfiles.js';

describe('publicSocialProfiles', () => {
  it('returns only verified public social profiles for reuse in UI and schema', () => {
    expect(getVerifiedSocialProfiles()).toEqual([
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
    expect(getVerifiedSameAsUrls()).toEqual([
      'https://www.facebook.com/happycolors.studio',
      'https://www.instagram.com/happycolors.crochet/',
      'https://happycolorsartshop.etsy.com/',
      'https://www.youtube.com/@HappyColorsCrochet',
      'https://www.tiktok.com/@happycolorscrochet',
    ]);
  });

  it('filters empty, local, preview, duplicate, and non-https profile URLs', () => {
    const profiles = [
      { service: 'facebook', href: 'https://www.facebook.com/happycolors.studio' },
      { service: 'facebook-duplicate', href: 'https://www.facebook.com/happycolors.studio' },
      { service: 'empty', href: '' },
      { service: 'local', href: 'http://localhost:3000/happycolors' },
      { service: 'preview', href: 'https://happy-colors-preview.onrender.com/happycolors' },
      { service: 'vercel', href: 'https://happy-colors.vercel.app/happycolors' },
      { service: 'http', href: 'http://example.com/happycolors' },
      { service: 'bad', href: 'not a url' },
    ];

    expect(getVerifiedSameAsUrls(profiles)).toEqual([
      'https://www.facebook.com/happycolors.studio',
    ]);
  });
});
