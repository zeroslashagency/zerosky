'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { resolveTrpcUrl } from '@/lib/trpc-url';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A 5s staleTime meant almost every screen change refetched from
            // scratch and showed a spinner. Terminal staff move between
            // screens constantly, so serve the cache immediately and
            // revalidate in the background instead: navigation feels instant
            // and the data is still fresh within a couple of minutes.
            staleTime: 2 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            // Keep figures honest without the per-mount storm: with 2m
            // staleTime, refetching on every focus produced duplicate
            // branch/order fetches on each section switch. Let polling
            // screens drive their own refetchInterval instead.
            refetchOnWindowFocus: false,
            // Polling screens (kitchen, tables, orders, billing) must not
            // keep hitting the API while the tab is hidden.
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: resolveTrpcUrl(),
          transformer: superjson,
          maxURLLength: 2083,
          maxBatchSize: 20,
          // The session token is an httpOnly cookie now, so JS cannot read it
          // and cannot put it in an Authorization header. The browser attaches
          // it itself as long as credentials are included.
          async fetch(url, options) {
            const res = await fetch(url, { ...options, credentials: 'include' });
            // Centralized 401 handling: a dead session should not linger as a
            // stale profile. Clear the cached user and bounce to login.
            if (res.status === 401 && typeof window !== 'undefined') {
              try {
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_timestamp');
                localStorage.removeItem('auth_token');
              } catch {}
              if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
              }
            }
            return res;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
