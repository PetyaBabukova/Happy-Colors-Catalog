'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import baseUrl from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/users/me`, {
        credentials: 'include',
      });

      if (res.status === 401) {
        setUser(null);
        return;
      }

      if (!res.ok) {
        const data = await readResponseJsonSafely(res);
        throw createResponseError(
          data?.message || 'Failed to fetch authenticated user',
          data
        );
      }

      const userData = await readResponseJsonSafely(res);

      if (!userData) {
        throw new Error('Invalid authenticated user response');
      }

      setUser(userData);
    } catch (err) {
      console.error('Auth refresh error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      refreshUser,
    }),
    [user, loading, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
