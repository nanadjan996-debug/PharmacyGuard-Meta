/**
 * PharmacyGuard — Authentication Context & Provider
 * Manages user session, token restoration, role-based access,
 * and live backend demo role switching.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, ApiError } from '../services/api';
import { UserProfileResponse, LoginRequest, UserRole } from '../types/api';

export const DEMO_CREDENTIALS: Record<UserRole, LoginRequest> = {
  staff_pharmacist: {
    username: 'pharmacist_demo',
    password: 'StaffDemoPassword2026!',
  },
  chief_pharmacist: {
    username: 'chief_demo',
    password: 'ChiefDemoPassword2026!',
  },
  pharmacy_student: {
    username: 'student_demo',
    password: 'StudentDemoPassword2026!',
  },
};

export interface AuthContextType {
  user: UserProfileResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<UserProfileResponse>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<UserProfileResponse>;
  clearError: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [token, setToken] = useState<string | null>(() => api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Listen to 401 Unauthorized events from the API client
  useEffect(() => {
    const unsubscribe = api.onUnauthorized(() => {
      setUser(null);
      setToken(null);
      setError('Your session has expired or authentication failed. Please sign in again.');
    });
    return unsubscribe;
  }, []);

  // Check existing token on initial mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // Check for deep-link / demo autologin query parameter
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const autoRole = params.get('autologin') as UserRole;
          if (autoRole && DEMO_CREDENTIALS[autoRole]) {
            const res = await api.auth.login(DEMO_CREDENTIALS[autoRole]);
            if (isMounted) {
              api.setToken(res.access_token);
              setToken(res.access_token);
              setUser(res.user);
              setIsLoading(false);
            }
            return;
          }
        } catch {
          // Fall back to normal token restoration
        }
      }

      const storedToken = api.getToken();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await api.auth.me();
        if (isMounted) {
          setUser(userProfile);
          setToken(storedToken);
        }
      } catch (err) {
        // Token was invalid or expired
        if (isMounted) {
          api.setToken(null);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest): Promise<UserProfileResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.auth.login(credentials);
      api.setToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Authentication failed. Please verify credentials.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (token) {
        await api.auth.logout();
      }
    } catch {
      // Best-effort backend logout, always clear frontend state
    } finally {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace');
        url.searchParams.delete('tab');
        url.searchParams.delete('case');
        url.searchParams.delete('rx');
        window.history.replaceState({}, '', url.toString());
      }
      api.setToken(null);
      setUser(null);
      setToken(null);
      setError(null);
      setIsLoading(false);
    }
  }, [token]);

  /**
   * Switch demo role via real backend authentication.
   * Never fabricates state; calls POST /auth/login with the role's demo credentials.
   */
  const switchRole = useCallback(
    async (role: UserRole): Promise<UserProfileResponse> => {
      const credentials = DEMO_CREDENTIALS[role];
      if (!credentials) {
        throw new Error(`Invalid demo role: ${role}`);
      }
      return await login(credentials);
    },
    [login]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user || !user.roles) return false;
      return user.roles.includes(role);
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    logout,
    switchRole,
    clearError,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

