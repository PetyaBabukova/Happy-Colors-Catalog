import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export const onRegisterSubmit = async (
  formValues,
  setSuccess,
  setError,
  setInvalidFields,
  setUser
) => {
  try {
    const res = await fetch(`${baseURL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues),
    });

    const result = await readResponseJsonSafely(res);

    if (!res.ok) {
      throw createResponseError(result?.message || 'Възникна грешка.', result);
    }

    setError('');
    setInvalidFields([]);

    await onLoginSubmit(
      { email: formValues.email, password: formValues.password },
      () => {},
      () => {},
      setUser
    );

    setSuccess(true);
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка.');
    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }
  }
};

export const onLoginSubmit = async (formValues, setSuccess, setError, setUser) => {
  try {
    const res = await fetch(`${baseURL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formValues),
    });

    const result = await readResponseJsonSafely(res);

    if (!res.ok) {
      throw new Error(result?.message || 'Невалиден e-mail или парола');
    }

    if (!result) {
      throw new Error('Неочакван отговор от сървъра.');
    }

    if (typeof setUser === 'function') {
      setUser({
        _id: result._id,
        username: result.username,
        email: result.email,
        role: result.role,
        artistStatus: result.artistStatus,
      });
    }

    setSuccess(true);
    setError('');
  } catch (err) {
    console.error('Login error:', err.message);
    setSuccess(false);
    setError('Невалиден e-mail или парола');
  }
};

export const logoutUser = async (setUser, router, setError = () => {}) => {
  try {
    const res = await fetch(`${baseURL}/users/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Грешка при изход');
    }

    if (typeof setUser === 'function') {
      setUser(null);
    }

    router.push('/');
  } catch (err) {
    console.error('Logout error:', err.message);
    setError('Неуспешен изход');
  }
};
