'use client';

import styles from './login.module.css';
import { useEffect } from 'react';
import MessageBox from '@/components/ui/MessageBox';
import { onLoginSubmit } from '@/managers/userManager';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getSafeRedirectPath } from '@/utils/authRedirect';
import useForm from '@/hooks/useForm';

export default function LoginClientPage() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();

  const {
    formValues,
    error,
    setError,
    success,
    setSuccess,
    handleChange,
  } = useForm({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onLoginSubmit(formValues, setSuccess, setError, setUser);
  };

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    // Intentionally read the real browser URL here instead of useSearchParams,
    // so this client page does not need an App Router Suspense boundary.
    const redirectParam = new URLSearchParams(window.location.search).get('redirect');
    router.replace(getSafeRedirectPath(redirectParam, '/products'));
  }, [loading, router, user]);

  return (
    <fieldset className={styles.registerFormContainer}>
      {error && <MessageBox type="error" message={error} />}
      {success && <MessageBox type="success" message={success} />}

      <legend>Login</legend>

      <form className={styles.registerForm} onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formValues.email}
          onChange={handleChange}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formValues.password}
          onChange={handleChange}
        />

        <button type="submit">Login</button>
      </form>
    </fieldset>
  );
}
