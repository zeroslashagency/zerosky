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
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: SafeUser) => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const router = useRouter();
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
    setToken(null);
    setUser(null);
    setShowTimeoutWarning(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_timestamp');
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

    // Token refresh at 12 minutes (720 seconds) - before expiry
    refreshTimer.current = setTimeout(() => {
      // TODO: Implement token refresh when backend supports it
      console.log('Token refresh would happen here');
    }, 12 * 60 * 1000);
  }, [logout]);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    const storedTimestamp = localStorage.getItem('auth_timestamp');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const timestamp = storedTimestamp ? parseInt(storedTimestamp, 10) : Date.now();
        const elapsed = Date.now() - timestamp;
        
        // Check if session expired (15 minutes)
        if (elapsed > 15 * 60 * 1000) {
          logout();
        } else {
          setToken(storedToken);
          setUser(parsedUser);
          setupSessionTimers();
        }
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        logout();
      }
    }
    
    setIsLoading(false);

    return () => clearTimers();
  }, [logout, setupSessionTimers]);

  const login = useCallback((newToken: string, newUser: SafeUser) => {
    setToken(newToken);
    setUser(newUser);
    const timestamp = Date.now();
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    localStorage.setItem('auth_timestamp', timestamp.toString());
    setupSessionTimers();
  }, [setupSessionTimers]);

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
    if (user && token) {
      setShowTimeoutWarning(false);
      const timestamp = Date.now();
      localStorage.setItem('auth_timestamp', timestamp.toString());
      setupSessionTimers();
    }
  }, [user, token, setupSessionTimers]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
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
