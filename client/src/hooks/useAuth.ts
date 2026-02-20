import { useState, useCallback } from 'react';
import axios from 'axios';

interface AuthState {
  accessToken: string | null;
  email: string | null;
  isAuthenticated: boolean;
}

interface UseAuth {
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  loading: boolean;
}

const API_BASE = '/api/v1';

export function useAuth(): UseAuth {
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    email: null,
    isAuthenticated: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE}/auth/login`,
        { email, password },
        { withCredentials: true },
      );
      // Store access token in memory only — refresh token is in httpOnly cookie (set by server)
      setAuth({ accessToken: data.accessToken, email, isAuthenticated: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    setAuth({ accessToken: null, email: null, isAuthenticated: false });
  }, []);

  return { auth, login, logout, error, loading };
}
