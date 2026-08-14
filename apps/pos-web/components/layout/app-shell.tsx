'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/mobile-nav';
import { useAuth } from '@/lib/auth-context';

/**
 * Chrome shared by every authenticated screen: sidebar, header and scrolling
 * content area.
 *
 * Rendering is gated on a resolved user. The middleware already redirects
 * unauthenticated requests, but on the client the auth context hydrates from
 * storage a tick later; without this gate the sidebar would briefly render with
 * no user and hide every nav item.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div id="zerosky-chrome-sidebar"><Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} /></div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div id="zerosky-chrome-header"><Header onMenuClick={() => setDrawerOpen(true)} /></div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background pb-[64px] lg:pb-0">{children}</main>
      </div>
      <div id="zerosky-chrome-bottomnav"><BottomNav /></div>
    </div>
  );
}
