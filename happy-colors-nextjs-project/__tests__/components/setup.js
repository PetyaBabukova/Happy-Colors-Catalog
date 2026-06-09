import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const mockRouter = {
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};
const mockNavigation = {
  params: {},
  pathname: '/',
  searchParams: new URLSearchParams(),
};
const mockNotFound = vi.fn(() => {
  const error = new Error('NEXT_NOT_FOUND');
  error.digest = 'NEXT_NOT_FOUND';
  throw error;
});

export function setMockRouter(overrides = {}) {
  Object.assign(mockRouter, overrides);
  return mockRouter;
}

export function setMockNavigation(overrides = {}) {
  Object.assign(mockNavigation, overrides);
  return mockNavigation;
}

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  useParams: vi.fn(() => mockNavigation.params),
  usePathname: vi.fn(() => mockNavigation.pathname),
  useRouter: vi.fn(() => mockRouter),
  useSearchParams: vi.fn(() => mockNavigation.searchParams),
}));

vi.mock('next/image', () => ({
  default: ({ alt, fill, priority, ...props }) => React.createElement('img', { alt, ...props }),
}));

beforeEach(() => {
  Object.values(mockRouter).forEach((value) => {
    if (typeof value?.mockClear === 'function') {
      value.mockClear();
    }
  });

  setMockRouter({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  });
  setMockNavigation({
    params: {},
    pathname: '/',
    searchParams: new URLSearchParams(),
  });
  mockNotFound.mockClear();
});

afterEach(() => {
  cleanup();
});
