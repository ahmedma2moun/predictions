import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/api/client';
import type { AuthUser, LoginResponse } from '@/types/api';

const TOKEN_KEY = 'fp_token';
const USER_KEY = 'fp_user';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        setState({
          token,
          user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
          loading: false,
        });
      } catch {
        setState({ token: null, user: null, loading: false });
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<LoginResponse>('/api/mobile/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, data.token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user)),
    ]);
    setState({ token: data.token, user: data.user, loading: false });
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    setState({ token: null, user: null, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
