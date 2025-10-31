'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  provider: 'wallet' | 'google' | 'apple';
  solanaPubkey: string;
  email?: string | null;
  // add other fields your prisma user has
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (params: { provider: 'wallet'|'google'|'apple'; token?: string; solanaPubkey?: string }) => Promise<void>;
  signup: (params: { provider: 'wallet'|'google'|'apple'; token?: string; solanaPubkey: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_TOKEN_KEY = 'app_token';
const STORAGE_USER_KEY = 'app_user';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))); // safe parse
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem(STORAGE_TOKEN_KEY) : null);
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate token on mount
    const validate = () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const payload = parseJwt(token);
      if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
        // expired
        setToken(null);
        setUser(null);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
      }
      setLoading(false);
    };
    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async ({ provider, token: providerToken, solanaPubkey }: { provider: 'wallet'|'google'|'apple'; token?: string; solanaPubkey?: string }) => {
    // POST to your existing backend /login route
    const payload: any = { provider };
    if (provider === 'wallet') payload.solanaPubkey = solanaPubkey;
    else payload.token = providerToken;

    const resp = await apiClient.post('/auth/login', payload);
    const { token: jwtToken, user: returnedUser } = resp.data;
    localStorage.setItem(STORAGE_TOKEN_KEY, jwtToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(returnedUser));
    setToken(jwtToken);
    setUser(returnedUser);
  };

  const signup = async ({ provider, token: providerToken, solanaPubkey }: { provider: 'wallet'|'google'|'apple'; token?: string; solanaPubkey: string }) => {
    const payload: any = { provider, solanaPubkey };
    if (provider !== 'wallet') payload.token = providerToken;

    const resp = await apiClient.post('/auth/signup', payload);
    const { token: jwtToken, user: returnedUser } = resp.data;
    localStorage.setItem(STORAGE_TOKEN_KEY, jwtToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(returnedUser));
    setToken(jwtToken);
    setUser(returnedUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    router.push('/login');
  };

  const isAuthenticated = () => {
    if (!token) return false;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return false;
    return Date.now() < payload.exp * 1000;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
