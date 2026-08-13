'use client';

import { useAuth } from '@/lib/auth-context';
import { User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Welcome back!</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
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
