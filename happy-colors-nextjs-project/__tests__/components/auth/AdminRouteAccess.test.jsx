import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthenticatedRedirect from '@/components/auth/AuthenticatedRedirect';
import RequireAuth from '@/components/auth/RequireAuth';
import RequireFullAdmin from '@/components/auth/RequireFullAdmin';
import { render, screen, waitFor } from '../test-utils.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const ownerUser = { _id: 'user-1', email: 'owner@example.com' };

const adminRoutes = [
  {
    name: '/users',
    path: '/users',
    pageFile: 'src/app/users/page.js',
    loggedRedirect: '/products',
  },
  {
    name: '/blog/create',
    path: '/blog/create',
    pageFile: 'src/app/blog/create/page.js',
    content: 'admin-content:blog-create',
  },
  {
    name: '/blog/[articleId]/edit',
    path: '/blog/article-1/edit',
    pageFile: 'src/app/blog/[articleId]/edit/page.js',
    content: 'admin-content:blog-edit',
  },
  {
    name: '/products/create',
    path: '/products/create',
    pageFile: 'src/app/products/create/page.js',
    content: 'admin-content:product-create',
  },
  {
    name: '/products/[productId]/edit',
    path: '/products/product-1/edit',
    pageFile: 'src/app/products/[productId]/edit/page.js',
    content: 'admin-content:product-edit',
  },
  {
    name: '/products/[productId]/delete',
    path: '/products/product-1/delete',
    pageFile: 'src/app/products/[productId]/delete/page.js',
    content: 'admin-content:product-delete',
  },
  {
    name: '/categories',
    path: '/categories',
    pageFile: 'src/app/categories/page.js',
    content: 'admin-content:categories',
  },
  {
    name: '/categories/create',
    path: '/categories/create',
    pageFile: 'src/app/categories/create/page.js',
    content: 'admin-content:category-create',
  },
  {
    name: '/categories/[categoryId]/edit',
    path: '/categories/category-1/edit',
    pageFile: 'src/app/categories/[categoryId]/edit/page.js',
    content: 'admin-content:category-edit',
  },
  {
    name: '/categories/delete',
    path: '/categories/delete',
    pageFile: 'src/app/categories/delete/page.js',
    loggedRedirect: '/categories',
  },
  {
    name: '/home-banners/create',
    path: '/home-banners/create',
    pageFile: 'src/app/home-banners/create/page.js',
    content: 'admin-content:home-banner-create',
  },
  {
    name: '/home-banners/[bannerId]/edit',
    path: '/home-banners/banner-1/edit',
    pageFile: 'src/app/home-banners/[bannerId]/edit/page.js',
    content: 'admin-content:home-banner-edit',
  },
  {
    name: '/homepage-featured',
    path: '/homepage-featured',
    pageFile: 'src/app/homepage-featured/page.js',
    content: 'admin-content:homepage-featured',
  },
  {
    name: '/users/admin',
    path: '/users/admin',
    pageFile: 'src/app/users/admin/page.js',
    content: 'admin-content:users-admin',
  },
];

function routeElement(route) {
  const child = route.loggedRedirect ? (
    <AuthenticatedRedirect to={route.loggedRedirect} message={`logged:${route.name}`} />
  ) : (
    <div>{route.content}</div>
  );

  return (
    <RequireAuth message={`guest:${route.name}`}>
      {child}
    </RequireAuth>
  );
}

describe('admin route access', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it.each(adminRoutes)('has a RequireAuth wrapper in the route file for $name', (route) => {
    const source = fs.readFileSync(path.join(projectRoot, route.pageFile), 'utf8');

    expect(source).toContain('RequireAuth');
  });

  it('locks /blog/create to full admin users on the frontend', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src/app/blog/create/page.js'), 'utf8');

    expect(source).toContain('RequireFullAdmin');

    const artistRender = render(
      <RequireAuth>
        <RequireFullAdmin>
          <div>admin-content:blog-create</div>
        </RequireFullAdmin>
      </RequireAuth>,
      {
        user: { _id: 'artist-1', role: 'artist', artistStatus: 'active' },
      }
    );

    expect(screen.queryByText('admin-content:blog-create')).not.toBeInTheDocument();
    expect(screen.getByText(/full admin/)).toBeInTheDocument();
    artistRender.unmount();

    render(
      <RequireAuth>
        <RequireFullAdmin>
          <div>admin-content:blog-create</div>
        </RequireFullAdmin>
      </RequireAuth>,
      {
        user: { _id: 'admin-1', role: 'full_admin' },
      }
    );

    expect(screen.getByText('admin-content:blog-create')).toBeInTheDocument();
  });

  it.each(adminRoutes)('redirects guests away from $name', (route) => {
    vi.useFakeTimers();
    window.history.pushState(null, '', route.path);
    const replace = vi.fn();

    render(routeElement(route), {
      user: null,
      routerOverrides: { replace },
    });

    expect(screen.getByText(`guest:${route.name}`)).toBeInTheDocument();
    if (route.content) {
      expect(screen.queryByText(route.content)).not.toBeInTheDocument();
    }
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(replace).toHaveBeenCalledWith(
      `/users/login?redirect=${encodeURIComponent(route.path)}`
    );
  });

  it.each(adminRoutes)('allows logged-in owner through $name', async (route) => {
    window.history.pushState(null, '', route.path);
    const replace = vi.fn();

    render(routeElement(route), {
      user: ownerUser,
      routerOverrides: { replace },
    });

    if (route.loggedRedirect) {
      expect(screen.getByText(`logged:${route.name}`)).toBeInTheDocument();
      await waitFor(() => expect(replace).toHaveBeenCalledWith(route.loggedRedirect));
      expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('/users/login'));
      return;
    }

    expect(screen.getByText(route.content)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
