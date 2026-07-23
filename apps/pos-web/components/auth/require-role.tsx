'use client';

import { useAuth, type Role } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RequireRoleProps {
  role?: Role;
  minRole?: Role;
  permission?: string;
  fallback?: React.ReactNode;
  redirectTo?: string;
  children: React.ReactNode;
}

export function RequireRole({ 
  role, 
  minRole, 
  permission, 
  fallback = null, 
  redirectTo,
  children 
}: RequireRoleProps) {
  const { user, hasRole, hasMinRole, can, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, user, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback}</>;
  }

  // Check role-based access
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  if (minRole && !hasMinRole(minRole)) {
    return <>{fallback}</>;
  }

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ShowForRoleProps {
  role?: Role;
  minRole?: Role;
  permission?: string;
  children: React.ReactNode;
}

export function ShowForRole({ role, minRole, permission, children }: ShowForRoleProps) {
  return (
    <RequireRole 
      role={role} 
      minRole={minRole} 
      permission={permission} 
      fallback={null}
    >
      {children}
    </RequireRole>
  );
}

interface HideForRoleProps {
  role?: Role;
  minRole?: Role;
  permission?: string;
  children: React.ReactNode;
}

export function HideForRole({ role, minRole, permission, children }: HideForRoleProps) {
  const { hasRole, hasMinRole, can, user } = useAuth();

  if (!user) return null;

  const shouldHide = 
    (role && hasRole(role)) ||
    (minRole && hasMinRole(minRole)) ||
    (permission && can(permission));

  if (shouldHide) return null;

  return <>{children}</>;
}
