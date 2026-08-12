import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutUser, onLoginSubmit, onRegisterSubmit } from '../../../src/managers/userManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('userManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('logs in with credentials and stores the returned user shape', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setUser = vi.fn();

    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          _id: 'user-1',
          username: 'petya',
          email: 'petya@example.com',
          role: 'full_admin',
          artistStatus: null,
          password: 'should-not-be-used',
        },
      })
    );

    await onLoginSubmit({ email: 'petya@example.com', password: 'secret' }, setSuccess, setError, setUser);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'petya@example.com', password: 'secret' }),
      })
    );
    expect(setUser).toHaveBeenCalledWith({
      _id: 'user-1',
      username: 'petya',
      email: 'petya@example.com',
      role: 'full_admin',
      artistStatus: null,
    });
    expect(setSuccess).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('keeps login failures generic and does not set a user', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setUser = vi.fn();

    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'specific backend reason' } }));

    await onLoginSubmit({ email: 'bad@example.com', password: 'wrong' }, setSuccess, setError, setUser);

    expect(setUser).not.toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith('Невалиден e-mail или парола');
  });

  it('registers, logs in the new user, and marks the flow successful', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const setUser = vi.fn();

    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'registered' } }))
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            _id: 'registered',
            username: 'petya',
            email: 'petya@example.com',
          },
        })
      );

    await onRegisterSubmit(
      { username: 'petya', email: 'petya@example.com', password: 'secret' },
      setSuccess,
      setError,
      setInvalidFields,
      setUser
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/users/register',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/users/login',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(setInvalidFields).toHaveBeenCalledWith([]);
    expect(setUser).toHaveBeenCalledWith({
      _id: 'registered',
      username: 'petya',
      email: 'petya@example.com',
    });
    expect(setSuccess).toHaveBeenLastCalledWith(true);
  });

  it('maps register field errors to invalid fields', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();

    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        body: { message: 'Email already exists', field: 'email' },
      })
    );

    await onRegisterSubmit(
      { email: 'petya@example.com', password: 'secret' },
      setSuccess,
      setError,
      setInvalidFields,
      vi.fn()
    );

    expect(setSuccess).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith('Email already exists');
    expect(setInvalidFields).toHaveBeenCalledWith(['email']);
  });

  it('logs out by clearing user state and navigating home', async () => {
    const setUser = vi.fn();
    const router = { push: vi.fn() };
    const setError = vi.fn();

    fetch.mockResolvedValueOnce(jsonResponse());

    await logoutUser(setUser, router, setError);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(setUser).toHaveBeenCalledWith(null);
    expect(router.push).toHaveBeenCalledWith('/');
    expect(setError).not.toHaveBeenCalled();
  });
});
