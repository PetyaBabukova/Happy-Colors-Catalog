import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import LoginClientPage from '@/app/users/login/LoginClientPage';
import LogoutClient from '@/app/users/logout/LogoutClient';
import RegisterForm from '@/app/users/register/RegisterForm';
import { AuthContext } from '@/context/AuthContext';
import { logoutUser, onLoginSubmit, onRegisterSubmit } from '@/managers/userManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/userManager', () => ({
  logoutUser: vi.fn(),
  onLoginSubmit: vi.fn(),
  onRegisterSubmit: vi.fn(),
}));

describe('auth UI components', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    onLoginSubmit.mockImplementation(async (values, setSuccess, setError, setUser) => {
      setUser({ _id: 'user-1', email: values.email });
      setError('');
      setSuccess(true);
    });
    onRegisterSubmit.mockImplementation(async (values, setSuccess, setError, setInvalidFields, setUser) => {
      setUser({ _id: 'user-1', email: values.email, username: values.username });
      setError('');
      setInvalidFields([]);
      setSuccess(true);
    });
    logoutUser.mockResolvedValue(undefined);
  });

  function StatefulLoginHarness({ initialUser = null, setUserSpy = vi.fn() }) {
    const [user, setLocalUser] = useState(initialUser);

    const setUser = (nextUser) => {
      setUserSpy(nextUser);
      setLocalUser(nextUser);
    };

    return (
      <AuthContext.Provider
        value={{
          user,
          loading: false,
          setUser,
          refreshUser: vi.fn(),
        }}
      >
        <LoginClientPage />
      </AuthContext.Provider>
    );
  }

  it('submits login credentials, stores the returned user, and redirects on success', async () => {
    const setUser = vi.fn();
    const mockRouterReplace = vi.fn();
    const { container } = render(<StatefulLoginHarness setUserSpy={setUser} />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#password'), { target: { value: 'secret' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(onLoginSubmit).toHaveBeenCalledWith(
        { email: 'petya@example.com', password: 'secret' },
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      )
    );
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/products'));
    expect(setUser).toHaveBeenCalledWith({ _id: 'user-1', email: 'petya@example.com' });
  });

  it('redirects to a safe requested route after login', async () => {
    window.history.pushState(null, '', '/users/login?redirect=%2Fblog%2Fcreate');
    const mockRouterReplace = vi.fn();
    const { container } = render(<StatefulLoginHarness />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#password'), { target: { value: 'secret' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/blog/create'));
  });

  it('falls back when login receives an unsafe redirect target', async () => {
    window.history.pushState(null, '', '/users/login?redirect=%5C%5Cevil.example');
    const mockRouterReplace = vi.fn();

    render(<StatefulLoginHarness initialUser={{ _id: 'user-1' }} />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/products'));
  });

  it('shows login errors from the manager without redirecting', async () => {
    onLoginSubmit.mockImplementationOnce(async (values, setSuccess, setError) => {
      setSuccess(false);
      setError('Invalid login');
    });
    const mockRouterPush = vi.fn();
    const { container } = render(<LoginClientPage />, { mockRouterPush });

    fireEvent.change(container.querySelector('#email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(container.querySelector('#password'), { target: { value: 'wrong' } });
    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByText('Invalid login')).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('validates register password confirmation before calling the manager', () => {
    const { container } = render(<RegisterForm />);

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'petya' } });
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret-1' } });
    fireEvent.change(container.querySelector('input[name="repeatPassword"]'), { target: { value: 'secret-2' } });
    fireEvent.submit(container.querySelector('form'));

    expect(onRegisterSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('input[name="password"]').className).not.toBe('');
    expect(container.querySelector('input[name="repeatPassword"]').className).not.toBe('');
  });

  it('submits registration data and redirects on success', async () => {
    const setUser = vi.fn();
    const mockRouterPush = vi.fn();
    const { container } = render(<RegisterForm />, {
      authOverrides: { setUser },
      mockRouterPush,
    });

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'petya' } });
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret' } });
    fireEvent.change(container.querySelector('input[name="repeatPassword"]'), { target: { value: 'secret' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(onRegisterSubmit).toHaveBeenCalledWith(
        {
          username: 'petya',
          email: 'petya@example.com',
          password: 'secret',
          repeatPassword: 'secret',
        },
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        setUser
      )
    );
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/products'));
    expect(setUser).toHaveBeenCalledWith({
      _id: 'user-1',
      email: 'petya@example.com',
      username: 'petya',
    });
  });

  it('renders register errors and invalid fields from the manager', async () => {
    onRegisterSubmit.mockImplementationOnce(async (values, setSuccess, setError, setInvalidFields) => {
      setSuccess(false);
      setError('Email exists');
      setInvalidFields(['email']);
    });
    const { container } = render(<RegisterForm />);

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'petya' } });
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret' } });
    fireEvent.change(container.querySelector('input[name="repeatPassword"]'), { target: { value: 'secret' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(container.textContent).toContain('Email exists'));
    expect(container.querySelector('input[name="email"]').className).not.toBe('');
  });

  it('logs out on mount using the auth state and router', async () => {
    const setUser = vi.fn();
    const mockRouterPush = vi.fn();

    render(<LogoutClient />, {
      authOverrides: { setUser },
      mockRouterPush,
    });

    await waitFor(() => expect(logoutUser).toHaveBeenCalledWith(setUser, expect.objectContaining({ push: mockRouterPush })));
  });
});
