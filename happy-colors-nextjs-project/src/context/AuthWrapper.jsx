'use client';
import { AuthProvider } from './AuthContext';

export default function AuthWrapper({ children, hasSessionHint = false }) {
  return <AuthProvider hasSessionHint={hasSessionHint}>{children}</AuthProvider>;
}

