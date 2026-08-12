'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import baseUrl from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children, hasSessionHint = false }) => {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const authVersionRef = useRef(0);

  const updateUser = useCallback((nextUser) => {
    authVersionRef.current += 1;
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const refreshVersion = authVersionRef.current;

    try {
      const res = await fetch(`${baseUrl}/users/me`, {
        credentials: 'include',
      });

      if (res.status === 401) {
        if (authVersionRef.current === refreshVersion) {
          setUser(null);
        }
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

      if (authVersionRef.current === refreshVersion) {
        setUser(userData);
      }
    } catch (err) {
      console.error('Auth refresh error:', err);
      if (authVersionRef.current === refreshVersion) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSessionHint) {
      setUser(null);
      setLoading(false);
      return;
    }

    refreshUser();
  }, [hasSessionHint, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      setUser: updateUser,
      loading,
      refreshUser,
    }),
    [user, loading, refreshUser, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
