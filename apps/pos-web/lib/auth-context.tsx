'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';

interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
}

interface AuthContextType {
  user: SafeUser | null;
  /**
   * True when a session is believed to be active. The token itself is an
   * httpOnly cookie and is deliberately NOT readable from JavaScript.
   */
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Persist a freshly-issued session. The tokens are handed to a server route
   * that writes httpOnly cookies; they are never stored in localStorage.
   */
  login: (tokens: { token: string; refreshToken?: string }, user: SafeUser) => Promise<void>;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasMinRole: (minRole: Role) => boolean;
  can: (permission: string) => boolean;
  isOwner: () => boolean;
  isManager: () => boolean;
  isCashier: () => boolean;
  isWaiter: () => boolean;
  isKitchen: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_HIERARCHY: Record<Role, number> = {
  KITCHEN: 1,
  WAITER: 2,
  CASHIER: 3,
  MANAGER: 4,
  OWNER: 5,
};

// Role-based permissions
const PERMISSIONS: Record<Role, string[]> = {
  OWNER: ['*'], // Full access
  MANAGER: ['view_reports', 'manage_menu', 'manage_tables', 'manage_staff', 'view_orders', 'manage_orders'],
  CASHIER: ['view_orders', 'manage_orders', 'process_payments', 'view_menu'],
  WAITER: ['view_orders', 'create_orders', 'view_menu', 'view_tables'],
  KITCHEN: ['view_orders', 'update_order_status', 'view_kot'],
};

/** Idle session lifetime; kept in step with the cookie Max-Age on the server. */
const SESSION_MAX_AGE_MS = 15 * 60 * 1000;

/** Server route that owns the httpOnly session cookies. */
const SESSION_ENDPOINT = '/api/auth/session';

/** Server route that rotates the access token using the httpOnly refresh cookie. */
const REFRESH_ENDPOINT = '/api/auth/refresh';

/**
 * Hand the freshly-issued tokens to the server so it can set httpOnly cookies.
 *
 * The token used to be written from JS (`document.cookie`), which meant any
 * injected script could read it. httpOnly cookies can only be set by a server
 * response, hence this round-trip.
 */
async function writeSessionCookies(tokens: {
  token: string;
  refreshToken?: string;
}): Promise<void> {
  const res = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(tokens),
  });
  if (!res.ok) {
    throw new Error('Could not establish session');
  }
}

/** Ask the server to clear the httpOnly cookies. */
function clearSessionCookies(): void {
  // Fire-and-forget: logout must not hang on the network. The client-side state
  // is cleared regardless and the middleware re-gates on the next navigation.
  void fetch(SESSION_ENDPOINT, { method: 'DELETE', credentials: 'include' }).catch(
    () => undefined,
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  /**
   * Restore the cached profile on mount.
   *
   * Only the non-sensitive profile lives in localStorage now; the token is an
   * httpOnly cookie the page cannot see. That cookie remains the real
   * authority: middleware gates navigation on it and the API verifies it, so a
   * stale profile here cannot grant access on its own.
   */
  const getInitialAuth = () => {
    if (typeof window === 'undefined') return { user: null };

    const storedUser = localStorage.getItem('auth_user');
    const storedTimestamp = localStorage.getItem('auth_timestamp');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const timestamp = storedTimestamp ? parseInt(storedTimestamp, 10) : 0;
        const elapsed = Date.now() - timestamp;

        // Same 15-minute idle window as the cookie Max-Age.
        if (elapsed <= SESSION_MAX_AGE_MS) {
          return { user: parsedUser as SafeUser };
        }
      } catch (error) {
        console.error('Failed to parse stored user:', error);
      }
    }

    return { user: null };
  };
  
  const [initialAuth] = useState(getInitialAuth);
  const [user, setUser] = useState<SafeUser | null>(initialAuth.user);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timeoutWarningTimer = useRef<NodeJS.Timeout | null>(null);
  const logoutTimer = useRef<NodeJS.Timeout | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (timeoutWarningTimer.current) clearTimeout(timeoutWarningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  };

  const logout = useCallback(() => {
    clearTimers();
    setUser(null);
    setShowTimeoutWarning(false);
    // Legacy key from when the token was stored client-side; removed so old
    // sessions do not leave a readable token behind after an upgrade.
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_timestamp');
    clearSessionCookies();
    router.push('/login');
  }, [router]);

  const setupSessionTimers = useCallback(() => {
    clearTimers();
    
    // Session timeout warning at 14 minutes (840 seconds)
    timeoutWarningTimer.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 14 * 60 * 1000);

    // Auto logout at 15 minutes (900 seconds)
    logoutTimer.current = setTimeout(() => {
      logout();
    }, 15 * 60 * 1000);

    // Rotate the access token at 12 minutes, before its 15-minute expiry.
    // The refresh token is httpOnly, so the server route does the exchange.
    refreshTimer.current = setTimeout(() => {
      void fetch(REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined);
    }, 12 * 60 * 1000);
  }, [logout]);

  useEffect(() => {
    // Setup timers on mount if user is already authenticated
    if (user) {
      setupSessionTimers();
    }
    
    // Mark loading complete after hydration
    const timer = setTimeout(() => setIsLoading(false), 0);

    return () => {
      clearTimeout(timer);
      clearTimers();
    };
  }, [user, setupSessionTimers]);

  const login = useCallback(
    async (tokens: { token: string; refreshToken?: string }, newUser: SafeUser) => {
      // Set the httpOnly cookies FIRST and await it. The middleware gates every
      // route on that cookie, so redirecting before it exists sends the user
      // straight back to /login.
      await writeSessionCookies(tokens);

      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      localStorage.setItem('auth_timestamp', Date.now().toString());
      setupSessionTimers();
    },
    [setupSessionTimers],
  );

  // RBAC helper functions
  const hasRole = useCallback((role: Role): boolean => {
    return user?.role === role;
  }, [user]);

  const hasMinRole = useCallback((minRole: Role): boolean => {
    if (!user) return false;
    return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minRole];
  }, [user]);

  const can = useCallback((permission: string): boolean => {
    if (!user) return false;
    const userPermissions = PERMISSIONS[user.role];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  }, [user]);

  const isOwner = useCallback(() => hasRole('OWNER'), [hasRole]);
  const isManager = useCallback(() => hasRole('MANAGER'), [hasRole]);
  const isCashier = useCallback(() => hasRole('CASHIER'), [hasRole]);
  const isWaiter = useCallback(() => hasRole('WAITER'), [hasRole]);
  const isKitchen = useCallback(() => hasRole('KITCHEN'), [hasRole]);

  const extendSession = useCallback(() => {
    if (user) {
      setShowTimeoutWarning(false);
      localStorage.setItem('auth_timestamp', Date.now().toString());
      setupSessionTimers();
    }
  }, [user, setupSessionTimers]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: user !== null, 
      isLoading, 
      login, 
      logout, 
      hasRole, 
      hasMinRole, 
      can,
      isOwner,
      isManager,
      isCashier,
      isWaiter,
      isKitchen
    }}>
      {children}
      
      {/* Session timeout warning modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Expiring Soon</h3>
            <p className="text-gray-600 mb-4">
              Your session will expire in 1 minute due to inactivity. Would you like to stay signed in?
            </p>
            <div className="flex gap-3">
              <button
                onClick={extendSession}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Stay Signed In
              </button>
              <button
                onClick={logout}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
