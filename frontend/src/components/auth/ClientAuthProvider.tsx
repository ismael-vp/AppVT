"use client";

import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return <>{children}</>;
}
