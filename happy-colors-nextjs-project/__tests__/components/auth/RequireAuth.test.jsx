import { act } from 'react';
import { render as rtlRender } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequireAuth from '@/components/auth/RequireAuth';
import { AuthContext } from '@/context/AuthContext';
import { setMockRouter } from '../setup.js';
import { render, screen } from '../test-utils.jsx';

describe('RequireAuth', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('renders a loading state while auth is being checked', () => {
    render(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
      { authOverrides: { loading: true, user: undefined } }
    );

    expect(screen.getByText('Зареждане...')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    render(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
      { user: { _id: 'user-1' } }
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('shows a message and redirects guests to login with the current path', () => {
    vi.useFakeTimers();
    window.history.pushState(null, '', '/blog/create?draft=1#content');
    const replace = vi.fn();

    render(
      <RequireAuth message="Нужен е вход.">
        <p>Protected content</p>
      </RequireAuth>,
      { user: null, routerOverrides: { replace } }
    );

    expect(screen.getByText('Нужен е вход.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(replace).toHaveBeenCalledWith(
      '/users/login?redirect=%2Fblog%2Fcreate%3Fdraft%3D1%23content'
    );
  });

  it('clears the redirect timer on unmount', () => {
    vi.useFakeTimers();
    const replace = vi.fn();

    const { unmount } = render(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
      { user: null, routerOverrides: { replace } }
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it('cancels a pending redirect when the user becomes authenticated', () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    setMockRouter({ replace });

    function Wrapper({ authValue, children }) {
      return (
        <AuthContext.Provider value={authValue}>
          {children}
        </AuthContext.Provider>
      );
    }

    const { rerender } = rtlRender(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
      {
        wrapper: ({ children }) => (
          <Wrapper authValue={{ user: null, loading: false }}>
            {children}
          </Wrapper>
        ),
      }
    );

    rerender(
      <AuthContext.Provider value={{ user: { _id: 'user-1' }, loading: false }}>
        <RequireAuth>
          <p>Protected content</p>
        </RequireAuth>
      </AuthContext.Provider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it('cancels a pending redirect when auth starts checking again', () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    setMockRouter({ replace });

    function Wrapper({ authValue, children }) {
      return (
        <AuthContext.Provider value={authValue}>
          {children}
        </AuthContext.Provider>
      );
    }

    const { rerender } = rtlRender(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
      {
        wrapper: ({ children }) => (
          <Wrapper authValue={{ user: null, loading: false }}>
            {children}
          </Wrapper>
        ),
      }
    );

    rerender(
      <AuthContext.Provider value={{ user: undefined, loading: true }}>
        <RequireAuth>
          <p>Protected content</p>
        </RequireAuth>
      </AuthContext.Provider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(replace).not.toHaveBeenCalled();
  });
});
