'use client';

import { useAuth } from '@/lib/auth-context';
import { Menu, User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 sm:px-6 sm:py-4 pt-safe">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            aria-label="Open navigation"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-card-foreground sm:text-xl">Welcome back!</h2>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <p className="text-xs text-muted-foreground sm:hidden">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <ThemeToggle />

          {/*
           * A notification bell used to live here. It had no handler and its
           * "unread" dot was hardcoded, so it advertised alerts that did not
           * exist and failed an axe check for having no accessible name.
           * It comes back when there is a real notification feed to open.
           */}

          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right">
              <p className="text-sm font-medium text-card-foreground">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.role || 'CASHIER'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
